# Ralph Wiggum technique

## Overview

This project uses Claude AI agents to help with feature development using the Ralph Wiggum technique. It includes skills for creating PRDs, critiquing plans, and addressing critiques. Docker sandboxing is used to isolate the AI environment.

## Setup

- Set up docker sandboxing
- Add claude skills
- Add features structure

You may gitignore the AI directory, but not the features/ directory, as that contains the PRD and progress files which the agent will modify and commit.

### Docker sandboxing

See [docker-sandbox.md](docker-sandbox.md) for full instructions.

### Skills

Copy the contents in the `skills-to-copy` directory into `.claude/skills/`, so that the structure is like this:

```
.claude/skills/
    create-prd/SKILL.md
    critique-plan/SKILL.md
    good-cop/SKILL.md
```

### Features structure

Copy the contents of `features-structure-to-copy` into the root of your project so that in the root you have the following structure:

```bash
features/
    current-feature/
        feature-request.md
        # The agent will create these files:
        # PRD.json
        # CRITIQUE.md
        # progress.txt
```

The feature-request of the feature you're working on should be defined in the feature-request.md file. The agent will create the PRD.json, CRITIQUE.md, and progress.txt files as needed. When you are done with a feature, delete or move the contents of current-feature/ out of that directory so that you can start a new feature in a clean current-feature/ directory.

## How to use

This project uses the "Ralph" technique for AI-assisted development. 

Create a feature request file in `features/current-feature/feature-request.md` describing the feature you want to implement.

To create a PRD.md, run claude with the create-prd skill in plan mode. It will help you convert your feature requirements into structured PRD items: `/create-prd`.

It will look for the feature-request.md in "features/current-feature" by default, but you can also provide it explicitly like so: `/create-prd @features/current-feature/feature-request.md`

Then with a separate plan agent, criticise the plan with the critique-plan skill: `/critique-plan`

It will look for the feature-request.md and PRD.json in the "features/current-feature" directory, but you can also provide them explicitly like so: `/critique-plan @features/current-feature/feature-request.md @features/current-feature/PRD.json`

Then with a separate plan agent, use the good-cop skill to sensibly address the valid concerns raised in the critique and update the plan accordingly: `/good-cop`

It will look for the feature-request.md, PRD.json, and CRITIQUE.md in the "features/current-feature" directory, but you can also provide them explicitly like so: `/good-cop @features/current-feature/feature-request.md @features/current-feature/PRD.json @features/current-feature/CRITIQUE.md`


Finally, use the ralph agent to implement the plan:

(Fyi, claude will commit its changes to the repo after every step in the loop. If it sees that it's on the main/master branch, it will create a new branch for the feature automatically, but it's best to create the branch yourself beforehand to give it a relevant name.)

- To run it once:
  - Make sure the script can be run: `chmod +x AI/ralph-once.sh`
  - run `AI/ralph-once.sh`
- To run the AFK Ralph mode:
  - Make sure the script can be run: `chmod +x AI/ralph-afk.sh`
  - run `AI/ralph-afk.sh <iterations>`, where the iterations argument is the number of loops/tasks to do, e.g. `AI/ralph-afk.sh 10` to do 10 tasks in a row.

