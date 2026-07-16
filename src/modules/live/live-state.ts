import { LudusPlayState } from './generated/proto/scoresaber/live/v1/common_pb';
import type { LiveExperienceState } from './live-types';

export const initialLiveState: LiveExperienceState = {
  audioBlocked: false,
  canChat: false,
  chatError: false,
  messages: [],
  pendingChatMessageIds: [],
  playState: LudusPlayState.UNSPECIFIED,
  status: 'connecting',
  viewerCount: null,
};
