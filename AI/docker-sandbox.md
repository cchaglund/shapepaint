To agents - this is not for you, stop reading here.

https://docs.docker.com/ai/sandboxes/ 

To init/run, run this in your project:
`docker sandbox run claude .`

It will create a linux VM with claude installed. All files in the current directory will be available inside the VM.

You will need docker desktop 4.50+ installed.


## Login

Currently there seems to be a bug in the latest docker desktop/sandbox, where Claude is hardcoded to use API usage billing. Basically, you start the container and see that Claude is configured for "API Usage Billing". Nothing that I've configured. You try to run /login, and after you authenticate, it says you're successfully logged in but still says "API Usage Billing". And if you try to chat with Claude it throws an API error. The problem is that the ~/.claude/settings.json file has `"apiKeyHelper": "echo proxy-managed"` hardcoded in it, which is forcing Claude into api-key mode. 

To fix this, you have to manually edit the settings file inside the sandbox VM.

Connect to the VM:
```bash
# Name of VM is usually "claude-[folder name]", e.g. "claude-my-project")
docker sandbox exec -it claude-my-project bash
```

Then edit the settings file by running:

```bash
# Edit the file
cat > ~/.claude/settings.json << 'EOF'
{
  "themeId": 1,
  "alwaysThinkingEnabled": true,
  "defaultMode": "bypassPermissions",
  "bypassPermissionsModeAccepted": true
}
EOF
```

Then run `exit` to leave the VM, and restart the sandbox: `docker sandbox run claude .`

You will need to authenticate now (only once per VM). Make sure you copy the URL properly, it could be a bit finicky.

## Zombie Reaper (Required)

### Why This Is Needed

The sandbox VM uses `sleep infinity` as PID 1 instead of a proper init system like `tini` or `systemd`. In normal Linux systems, when a parent process dies, its orphaned children are adopted by PID 1, which is responsible for reaping them (cleaning up their process table entries) when they exit.

Without a proper init system:
- Orphaned child processes (from builds, test runners, dev servers, etc.) never get reaped
- They accumulate as zombie processes (`<defunct>` in process listings)
- Over many Claude sessions, this causes severe VM degradation
- Eventually native binaries (esbuild, vite, node-gyp, etc.) start crashing with "Illegal instruction" or "Bus error"

The solution is a Python daemon that uses Linux's `PR_SET_CHILD_SUBREAPER` capability to mark itself as a subreaper. This makes orphaned processes get reparented to the daemon instead of PID 1, and the daemon properly reaps them when they exit.

**Install this in every new VM to prevent zombie accumulation.**

---

**Copy-paste this to the agent:**

This is a Docker Sandbox VM (https://docs.docker.com/ai/sandboxes/) — a persistent                           
Linux VM, NOT an ephemeral container. It uses `sleep infinity` as PID 1, which means                         
orphaned processes are never reaped and accumulate as zombies across sessions. This is                       
a known issue documented in this project's AI/docker-sandbox.md.                                             

The fix is a lightweight Python subreaper daemon. This is the standard approach for                          
non-PID-1 zombie reaping (using Linux's prctl PR_SET_CHILD_SUBREAPER). We use a                              
Python script rather than tini because tini must be PID 1 or run as a wrapper around                         
a specific command — it can't retroactively adopt orphans from other process trees                           
when run standalone.                                                                                         

Install the zombie reaper by running these commands:

```sudo tee /usr/local/bin/zombie-reaper.py << 'PYEOF'
#!/usr/bin/env python3
"""Zombie reaper - marks itself as subreaper and reaps orphaned children"""
import os, signal, ctypes, time
libc = ctypes.CDLL("libc.so.6", use_errno=True)
if libc.prctl(36, 1, 0, 0, 0) != 0:
    print(f"Failed to set subreaper"); exit(1)
print(f"Zombie reaper running as PID {os.getpid()}")
def reap(signum, frame):
    while True:
        try:
            pid, _ = os.waitpid(-1, os.WNOHANG)
            if pid == 0: break
            print(f"Reaped zombie PID {pid}")
        except ChildProcessError: break
signal.signal(signal.SIGCHLD, reap)
while True: time.sleep(60)
PYEOF

sudo chmod +x /usr/local/bin/zombie-reaper.py

sudo tee /etc/profile.d/zombie-reaper.sh << 'SHEOF'
if ! pgrep -f zombie-reaper.py > /dev/null; then
    nohup python3 /usr/local/bin/zombie-reaper.py > /tmp/zombie-reaper.log 2>&1 &
fi
SHEOF

nohup python3 /usr/local/bin/zombie-reaper.py > /tmp/zombie-reaper.log 2>&1 &

# Verify it's running
sleep 1
if pgrep -f zombie-reaper.py > /dev/null; then
    echo "✓ Zombie reaper installed and running"
else
    echo "✗ Failed to start zombie reaper"
fi
```

## MCPs

To add an MCP tool, you'll have to ask claude to install it for you, e.g.: 
```can you add the playwright mcp? i know it'll only become available in the next session. this is the command: `claude mcp add playwright npx @playwright/mcp@latest````

Then you'll have to stop (regular ctrl-c) and restart the sandbox for it to take effect. You can check by simply asking claude: `❯ can you list the installed mcp tools?`

Chrome, and therefore regular playwright, isn't supported on ARM64 linux. You can ask it to use firefox instead:
```bash
❯ can you configure the playwright mcp to use firefox instead of chrome? This should be done in "~/.claude.json" and when you're done the config should look a little like this:
`"args": [
     "@playwright/mcp@latest",
     "--browser",
     "firefox"
],`
```



Note: if you update docker desktop, your VMs will be deleted and you'll have to re-run the above commands.

Ask the agent to install any packages you need using apt, yum, etc.

"When an agent runs docker build or docker compose up, those commands execute inside the sandbox using the private daemon. The agent sees only containers it creates. It cannot access your host containers, images, or volumes."

Important! These persist until you remove the VM:
- Docker images and containers - Built or pulled by the agent
- Installed packages - System packages added with apt, yum, etc.
- Agent state - Credentials, configuration, history
- Workspace changes - Files created or modified sync back to host

Each sandbox has its own:
- Docker daemon state
- Image cache
- Package installations

When you remove a sandbox with docker sandbox rm, the entire VM and its contents are deleted. Images built inside the sandbox, packages installed, and any state not synced to your workspace are gone.

Access the sandbox directly with an interactive shell:
`docker sandbox exec -it <sandbox-name> bash`

Inside the shell, you can inspect the environment, manually install packages, or check Docker containers:
```bash
    agent@sandbox:~$ docker ps
    agent@sandbox:~$ docker images
```

# PROBLEMS WITH THE SANDBOX

## Zombie Process Accumulation

The sandbox VM uses `sleep infinity` as PID 1 instead of a proper init system (like `tini`) this means orphaned child processes never get reaped and become zombies. If you run many Claude sessions (especially with a script that loops), zombies accumulate and can eventually degrade the VM to the point where native binaries (esbuild, vite, etc.) start crashing with "Illegal instruction" or "Bus error".

**To check zombie count:**
```bash
# Exec in
docker sandbox exec -it <sandbox-name> bash

# Check zombie count
ps aux | grep -c defunct
```

**Fix:** Install the zombie reaper (see "Zombie Reaper" section in initial setup above).

**Note:** The reaper only prevents NEW zombies. Existing zombies are stuck until the VM is recreated. If native binaries are crashing, you may need to `docker sandbox rm <name>` and start fresh.

## ARM64 Linux Binary Incompatibility

The sandbox VM runs ARM64 Linux. When the agent installs npm packages, they're Linux ARM64 binaries. Your Mac also runs ARM64 but with Darwin (macOS), so the native binaries are incompatible.

Old workaround (annoying): `rm -rf node_modules && npm install` every time you switch between running locally and in the sandbox.

(Can the agent inside the VM run "make dev" for projects that use kubernetes?)

# Container solution!

Run the dev server in a Docker container with the same architecture as the sandbox (Linux ARM64). The entire repo is mounted, so it uses the same node_modules the agent installed.

**To start:**

Copy the dockerfile-to-copy/Dockerfile.dev to the root of your project as `Dockerfile.dev`, then run:

```
npm run dev:docker
```

**What it does:**
- Builds a lightweight container from `Dockerfile.dev`
- Mounts the repo into the container
- Starts Vite on port 5173
- Logs stream to your terminal
- Ctrl+C to stop (ignore the npm SIGINT messages, they're normal)

**View the app:** http://localhost:5173

Hot reload works - edit files locally and changes appear in the browser.
