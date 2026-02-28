import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  type KeyMappings,
  type KeyboardActionId,
  type KeyBinding,
  getDefaultMappings,
  findConflicts,
  KEYBOARD_ACTIONS,
} from '../../constants/keyboardActions';

const STORAGE_KEY = '2colors2shapes_keyboard_settings';

interface StoredSettings {
  mappings: KeyMappings;
  version: number;
}

const CURRENT_VERSION = 3;

/** Migrate v1 → v2: remap mirrorH from H→M, mirrorV from V→Shift+M */
function migrateV1ToV2(mappings: KeyMappings): KeyMappings {
  const migrated = { ...mappings };
  if (migrated.mirrorHorizontal?.key === 'KeyH' && !migrated.mirrorHorizontal.shift) {
    migrated.mirrorHorizontal = { key: 'KeyM' };
  }
  if (migrated.mirrorVertical?.key === 'KeyV' && !migrated.mirrorVertical.shift) {
    migrated.mirrorVertical = { key: 'KeyM', shift: true };
  }
  return migrated;
}

/** Migrate v2 → v3: revert mirrorH from M→H, mirrorV from Shift+M→V, remove selectMode */
function migrateV2ToV3(mappings: KeyMappings): KeyMappings {
  const migrated = { ...mappings };
  if (migrated.mirrorHorizontal?.key === 'KeyM' && !migrated.mirrorHorizontal.shift) {
    migrated.mirrorHorizontal = { key: 'KeyH' };
  }
  if (migrated.mirrorVertical?.key === 'KeyM' && migrated.mirrorVertical?.shift) {
    migrated.mirrorVertical = { key: 'KeyV' };
  }
  // Remove selectMode — no longer exists
  delete (migrated as Record<string, unknown>).selectMode;
  return migrated;
}

function migrateToLatest(mappings: KeyMappings, fromVersion: number): KeyMappings {
  let migrated = mappings;
  if (fromVersion < 2) migrated = migrateV1ToV2(migrated);
  if (fromVersion < 3) migrated = migrateV2ToV3(migrated);
  return migrated;
}

function loadFromLocalStorage(): KeyMappings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: StoredSettings = JSON.parse(stored);
      if (parsed.mappings) {
        let mappings = parsed.mappings;
        if (parsed.version < CURRENT_VERSION) {
          mappings = migrateToLatest(mappings, parsed.version);
          saveToLocalStorage({ ...getDefaultMappings(), ...mappings });
        }
        // Merge with defaults in case new actions were added
        return { ...getDefaultMappings(), ...mappings };
      }
    }
  } catch (e) {
    console.error('Failed to load keyboard settings from localStorage:', e);
  }
  return getDefaultMappings();
}

function saveToLocalStorage(mappings: KeyMappings): void {
  try {
    const data: StoredSettings = {
      mappings,
      version: CURRENT_VERSION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save keyboard settings to localStorage:', e);
  }
}

export function useKeyboardSettings(userId: string | undefined) {
  const [mappings, setMappings] = useState<KeyMappings>(getDefaultMappings);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Load settings on mount and when user changes
  useEffect(() => {
    async function loadSettings() {
      setLoading(true);

      if (userId) {
        // Try to load from Supabase for logged-in users
        try {
          const { data, error } = await supabase
            .from('keyboard_settings')
            .select('mappings')
            .eq('user_id', userId)
            .single();

          if (error) {
            if (error.code === 'PGRST116') {
              // No record found, check localStorage for migration
              const localMappings = loadFromLocalStorage();
              setMappings(localMappings);
              // Save to Supabase
              await supabase.from('keyboard_settings').insert({
                user_id: userId,
                mappings: localMappings,
              });
            } else {
              console.error('Error loading keyboard settings:', error);
              // Fall back to localStorage
              setMappings(loadFromLocalStorage());
            }
          } else if (data?.mappings) {
            let dbMappings = data.mappings as KeyMappings;
            // Detect pre-v3 data: if selectMode key exists or mirror keys use old defaults
            const needsMigration = ('selectMode' in (dbMappings as Record<string, unknown>)) ||
              (dbMappings.mirrorHorizontal?.key === 'KeyM' && !dbMappings.mirrorHorizontal.shift);
            if (needsMigration) {
              // Determine version: if selectMode exists it was at least v2, otherwise v1
              const fromVersion = ('selectMode' in (dbMappings as Record<string, unknown>)) ? 2 : 1;
              dbMappings = migrateToLatest(dbMappings, fromVersion);
              supabase
                .from('keyboard_settings')
                .upsert({ user_id: userId, mappings: { ...getDefaultMappings(), ...dbMappings }, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
                .then(({ error: e2 }) => { if (e2) console.error('Failed to persist keyboard migration:', e2); });
            }
            // Merge with defaults in case new actions were added
            setMappings({ ...getDefaultMappings(), ...dbMappings });
          }
        } catch (e) {
          console.error('Failed to load keyboard settings from Supabase:', e);
          setMappings(loadFromLocalStorage());
        }
      } else {
        // Anonymous user - use localStorage
        setMappings(loadFromLocalStorage());
      }

      setLoading(false);
    }

    loadSettings();
  }, [userId]);

  // Update a single key binding
  const updateBinding = useCallback(
    async (
      actionId: KeyboardActionId,
      newBinding: KeyBinding,
      resolveConflicts: boolean = true
    ): Promise<{ success: boolean; conflicts?: KeyboardActionId[] }> => {
      // Check for conflicts
      const conflicts = findConflicts(mappings, actionId, newBinding);

      if (conflicts.length > 0 && !resolveConflicts) {
        return { success: false, conflicts };
      }

      // Create new mappings
      const newMappings = { ...mappings };
      newMappings[actionId] = newBinding;

      // Remove conflicting bindings if resolving
      if (resolveConflicts) {
        for (const conflictId of conflicts) {
          // Reset conflicting action to undefined (will show as "Not set")
          delete newMappings[conflictId];
        }
      }

      setMappings(newMappings);

      // Save to storage
      if (userId) {
        setSyncing(true);
        try {
          const { error } = await supabase
            .from('keyboard_settings')
            .upsert(
              {
                user_id: userId,
                mappings: newMappings,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' }
            );
          if (error) {
            console.error('Failed to save keyboard settings to Supabase:', error);
          }
        } catch (e) {
          console.error('Failed to sync keyboard settings:', e);
        }
        setSyncing(false);
      } else {
        saveToLocalStorage(newMappings);
      }

      return { success: true, conflicts: resolveConflicts ? conflicts : undefined };
    },
    [mappings, userId]
  );

  // Reset a single binding to default
  const resetBinding = useCallback(
    async (actionId: KeyboardActionId) => {
      const action = KEYBOARD_ACTIONS.find((a) => a.id === actionId);
      if (action) {
        await updateBinding(actionId, { ...action.defaultBinding });
      }
    },
    [updateBinding]
  );

  // Reset all bindings to defaults
  const resetAllBindings = useCallback(async () => {
    const defaults = getDefaultMappings();
    setMappings(defaults);

    if (userId) {
      setSyncing(true);
      try {
        const { error } = await supabase
          .from('keyboard_settings')
          .upsert(
            {
              user_id: userId,
              mappings: defaults,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
        if (error) {
          console.error('Failed to reset keyboard settings in Supabase:', error);
        }
      } catch (e) {
        console.error('Failed to sync keyboard settings reset:', e);
      }
      setSyncing(false);
    } else {
      saveToLocalStorage(defaults);
    }
  }, [userId]);

  // Get the current binding for an action
  const getBinding = useCallback(
    (actionId: KeyboardActionId): KeyBinding | undefined => {
      return mappings[actionId];
    },
    [mappings]
  );

  return {
    mappings,
    loading,
    syncing,
    updateBinding,
    resetBinding,
    resetAllBindings,
    getBinding,
  };
}
