/* errors.mjs: the error types the reducer puts in state.transients.error.type.
   Ported from boardgame.io src/core/errors.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors; the
   licence is ../LICENSE). Changed: the two TypeScript string enums are plain objects (what tsc emits for them). */

export const UpdateErrorType = {
  // The action’s credentials were missing or invalid
  UnauthorizedAction: 'update/unauthorized_action',
  // The action’s matchID was not found
  MatchNotFound: 'update/match_not_found',
  // Could not apply Patch operation (rfc6902). Kept for the taxonomy; this port has no PATCH, so never raises it.
  PatchFailed: 'update/patch_failed',
};

export const ActionErrorType = {
  // The action contained a stale state ID
  StaleStateId: 'action/stale_state_id',
  // The requested move is unknown or not currently available
  UnavailableMove: 'action/unavailable_move',
  // The move declared it was invalid (INVALID_MOVE constant)
  InvalidMove: 'action/invalid_move',
  // The player making the action is not currently active
  InactivePlayer: 'action/inactive_player',
  // The game has finished
  GameOver: 'action/gameover',
  // The requested action is disabled (e.g. undo/redo, events)
  ActionDisabled: 'action/action_disabled',
  // The requested action is not currently possible
  ActionInvalid: 'action/action_invalid',
  // The requested action was declared invalid by a plugin
  PluginActionInvalid: 'action/plugin_invalid',
};
