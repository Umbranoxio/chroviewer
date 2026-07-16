import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { Result } from 'better-result';

import { LiveChatMessageRequestSchema } from './generated/proto/scoresaber/live/v1/chat_pb';
import { LivePlayerPlatform, LudusClientType } from './generated/proto/scoresaber/live/v1/common_pb';
import { LudusEnvelopeSchema, type LudusEnvelope } from './generated/proto/scoresaber/live/v1/ludus_pb';
import { FollowRoomRequestSchema, LudusRoomContextType } from './generated/proto/scoresaber/live/v1/room_actions_pb';
import { ConnectRequestSchema, HeartbeatSchema } from './generated/proto/scoresaber/live/v1/session_pb';

const protocolVersion = 1;

interface EnvelopeOptions {
  connectionId?: string;
  messageId?: string;
  sequence: bigint;
}

function encodeEnvelope(body: LudusEnvelope['body'], options: EnvelopeOptions) {
  return toBinary(
    LudusEnvelopeSchema,
    create(LudusEnvelopeSchema, {
      protocolVersion,
      messageId: options.messageId ?? crypto.randomUUID(),
      connectionId: options.connectionId,
      sequence: options.sequence,
      clientTimeUnixMs: BigInt(Date.now()),
      body,
    }),
  );
}

export function decodeLudusEnvelope(bytes: ArrayBuffer) {
  return Result.try(() => fromBinary(LudusEnvelopeSchema, new Uint8Array(bytes)));
}

export function encodeConnectEnvelope(
  input: { authToken?: string; playerId?: string; tournamentId?: string },
  sequence: bigint,
) {
  return encodeEnvelope(
    {
      case: 'connectRequest',
      value: create(ConnectRequestSchema, {
        authToken: input.authToken,
        playerId: input.playerId,
        tournamentId: input.tournamentId,
        platform: LivePlayerPlatform.UNSPECIFIED,
        clientType: LudusClientType.SPECTATOR,
        initialRoomContext:
          input.tournamentId === undefined ? LudusRoomContextType.PUBLIC_PRESENCE : LudusRoomContextType.TOURNAMENT,
      }),
    },
    { sequence },
  );
}

export function encodeFollowRoomEnvelope(matchId: string, playerId: string, sequence: bigint, connectionId: string) {
  return encodeEnvelope(
    {
      case: 'followRoomRequest',
      value: create(FollowRoomRequestSchema, { matchId, playerId }),
    },
    { sequence, connectionId },
  );
}

export function encodeHeartbeatEnvelope(lastReceivedSequence: bigint, sequence: bigint, connectionId: string) {
  return encodeEnvelope(
    {
      case: 'heartbeat',
      value: create(HeartbeatSchema, { lastReceivedSequence }),
    },
    { sequence, connectionId },
  );
}

export function encodeChatEnvelope(
  matchId: string,
  text: string,
  sequence: bigint,
  connectionId: string,
  messageId: string,
) {
  return encodeEnvelope(
    {
      case: 'chatMessageRequest',
      value: create(LiveChatMessageRequestSchema, { matchId, text }),
    },
    { sequence, connectionId, messageId },
  );
}

export function ludusWebSocketUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  if (url.protocol === 'https:') url.protocol = 'wss:';
  else if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.pathname === '' || url.pathname === '/') url.pathname = '/v1/connect';
  return url.toString();
}
