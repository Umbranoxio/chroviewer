/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface AccountStandingEntry {
  /** @format date-time */
  createdAt?: string;
  description?: string;
  /** @format int32 */
  lengthMinutes?: number;
  status?: "ACTIVE" | "REVOKED" | "EXPIRED";
  type?: "Review" | "Upload";
}

export type Float = number;

export type GetMapByHashData = MapDetail;

export type GetMapByIdData = MapDetail;

export interface MapDetail {
  automapper?: boolean;
  blQualified?: boolean;
  blRanked?: boolean;
  bookmarked?: boolean;
  collaborators?: UserDetail[];
  /** @format date-time */
  createdAt?: string;
  /** @format date-time */
  curatedAt?: string;
  /** UserDetail */
  curator?: UserDetail;
  declaredAi?: "Admin" | "Uploader" | "SageScore" | "None";
  /** @format date-time */
  deletedAt?: string;
  description?: string;
  id?: string;
  /** @format date-time */
  lastPublishedAt?: string;
  /** MapDetailMetadata */
  metadata?: MapDetailMetadata;
  name?: string;
  nsfw?: boolean;
  qualified?: boolean;
  ranked?: boolean;
  /** MapStats */
  stats?: MapStats;
  tags?: (
    | ""
    | "tech"
    | "dance-style"
    | "speed"
    | "balanced"
    | "challenge"
    | "accuracy"
    | "fitness"
    | "poodle"
    | "swing"
    | "nightcore"
    | "folk-acoustic"
    | "kids-family"
    | "ambient"
    | "funk-disco"
    | "jazz"
    | "classical-orchestral"
    | "soul"
    | "speedcore"
    | "punk"
    | "rb"
    | "holiday"
    | "vocaloid"
    | "j-rock"
    | "trance"
    | "drum-and-bass"
    | "comedy-meme"
    | "instrumental"
    | "hardcore"
    | "k-pop"
    | "indie"
    | "techno"
    | "house"
    | "video-game-soundtrack"
    | "tv-movie-soundtrack"
    | "alternative"
    | "dubstep"
    | "metal"
    | "anime"
    | "hip-hop-rap"
    | "j-pop"
    | "dance"
    | "rock"
    | "pop"
    | "electronic"
    | "ai"
  )[];
  /** @format date-time */
  updatedAt?: string;
  /** @format date-time */
  uploaded?: string;
  /** UserDetail */
  uploader?: UserDetail;
  versions?: MapVersion[];
}

export interface MapDetailMetadata {
  /** Float */
  bpm?: Float;
  /** @format int32 */
  duration?: number;
  levelAuthorName?: string;
  songAuthorName?: string;
  songName?: string;
  songSubName?: string;
}

export interface MapDifficulty {
  /** Float */
  blStars?: Float;
  /** @format int32 */
  bombs?: number;
  characteristic?:
    | "Standard"
    | "OneSaber"
    | "NoArrows"
    | "90Degree"
    | "360Degree"
    | "Lightshow"
    | "Lawless"
    | "Legacy";
  chroma?: boolean;
  cinema?: boolean;
  difficulty?: "Easy" | "Normal" | "Hard" | "Expert" | "ExpertPlus";
  environment?:
    | "DefaultEnvironment"
    | "TriangleEnvironment"
    | "NiceEnvironment"
    | "BigMirrorEnvironment"
    | "KDAEnvironment"
    | "MonstercatEnvironment"
    | "CrabRaveEnvironment"
    | "DragonsEnvironment"
    | "OriginsEnvironment"
    | "PanicEnvironment"
    | "RocketEnvironment"
    | "GreenDayEnvironment"
    | "GreenDayGrenadeEnvironment"
    | "TimbalandEnvironment"
    | "FitBeatEnvironment"
    | "LinkinParkEnvironment"
    | "BTSEnvironment"
    | "KaleidoscopeEnvironment"
    | "InterscopeEnvironment"
    | "SkrillexEnvironment"
    | "BillieEnvironment"
    | "HalloweenEnvironment"
    | "GagaEnvironment"
    | "Halloween2Environment"
    | "GlassDesertEnvironment"
    | "MultiplayerEnvironment"
    | "WeaveEnvironment"
    | "PyroEnvironment"
    | "EDMEnvironment"
    | "TheSecondEnvironment"
    | "LizzoEnvironment"
    | "TheWeekndEnvironment"
    | "RockMixtapeEnvironment"
    | "Dragons2Environment"
    | "Panic2Environment"
    | "QueenEnvironment"
    | "LinkinPark2Environment"
    | "TheRollingStonesEnvironment"
    | "LatticeEnvironment"
    | "DaftPunkEnvironment"
    | "HipHopEnvironment"
    | "ColliderEnvironment"
    | "BritneyEnvironment"
    | "Monstercat2Environment"
    | "MetallicaEnvironment"
    | "GridEnvironment"
    | "ColdplayEnvironment"
    | "ProdigyEnvironment";
  /** @format int32 */
  events?: number;
  label?: string;
  /** @format double */
  length?: number;
  /** @format int32 */
  maxScore?: number;
  me?: boolean;
  ne?: boolean;
  /** Float */
  njs?: Float;
  /** @format int32 */
  notes?: number;
  /** @format double */
  nps?: number;
  /** @format int32 */
  obstacles?: number;
  /** Float */
  offset?: Float;
  /** MapParitySummary */
  paritySummary?: MapParitySummary;
  /** @format double */
  seconds?: number;
  /** Float */
  stars?: Float;
  vivify?: boolean;
}

export interface MapParitySummary {
  /** @format int32 */
  errors?: number;
  /** @format int32 */
  resets?: number;
  /** @format int32 */
  warns?: number;
}

export interface MapStats {
  /** @format int32 */
  downloads?: number;
  /** @format int32 */
  downvotes?: number;
  /** @format int32 */
  plays?: number;
  /** @format int32 */
  reviews?: number;
  /** Float */
  score?: Float;
  /** Float */
  scoreOneDP?: Float;
  sentiment?:
    | "PENDING"
    | "VERY_NEGATIVE"
    | "MOSTLY_NEGATIVE"
    | "MIXED"
    | "MOSTLY_POSITIVE"
    | "VERY_POSITIVE";
  /** @format int32 */
  upvotes?: number;
}

export interface MapTestplay {
  /** @format date-time */
  createdAt?: string;
  feedback?: string;
  /** @format date-time */
  feedbackAt?: string;
  /** UserDetail */
  user?: UserDetail;
  video?: string;
}

export interface MapVersion {
  coverURL?: string;
  /** @format date-time */
  createdAt?: string;
  diffs?: MapDifficulty[];
  downloadURL?: string;
  feedback?: string;
  hash?: string;
  key?: string;
  previewURL?: string;
  /** Short */
  sageScore?: Short;
  /** @format date-time */
  scheduledAt?: string;
  state?: "Uploaded" | "Testplay" | "Published" | "Feedback" | "Scheduled";
  /** @format date-time */
  testplayAt?: string;
  testplays?: MapTestplay[];
}

export type Short = number;

export interface UserDetail {
  accountStanding?: AccountStandingEntry[];
  admin?: boolean;
  avatar?: string;
  blurnsfw?: boolean;
  curator?: boolean;
  curatorTab?: boolean;
  description?: string;
  email?: string;
  /** UserFollowData */
  followData?: UserFollowData;
  hash?: string;
  /** @format int32 */
  id?: number;
  name?: string;
  patreon?: "None" | "Supporter" | "SupporterPlus";
  playlistUrl?: string;
  seniorCurator?: boolean;
  /** UserStats */
  stats?: UserStats;
  suspensions?: ("Review" | "Upload")[];
  testplay?: boolean;
  type?: "DISCORD" | "SIMPLE" | "DUAL";
  uniqueSet?: boolean;
  /** @format int32 */
  uploadLimit?: number;
  verifiedMapper?: boolean;
  /** @format int32 */
  vivifyLimit?: number;
}

export interface UserDiffStats {
  /** @format int32 */
  easy?: number;
  /** @format int32 */
  expert?: number;
  /** @format int32 */
  expertPlus?: number;
  /** @format int32 */
  hard?: number;
  /** @format int32 */
  normal?: number;
  /** @format int32 */
  total?: number;
}

export interface UserFollowData {
  collab?: boolean;
  curation?: boolean;
  /** @format int32 */
  followers?: number;
  following?: boolean;
  /** @format int32 */
  follows?: number;
  upload?: boolean;
}

export interface UserStats {
  /** Float */
  avgBpm?: Float;
  /** Float */
  avgDuration?: Float;
  /** Float */
  avgScore?: Float;
  /** UserDiffStats */
  diffStats?: UserDiffStats;
  /** @format date-time */
  firstUpload?: string;
  /** @format date-time */
  lastUpload?: string;
  /** @format int32 */
  rankedMaps?: number;
  /** @format int32 */
  totalDownvotes?: number;
  /** @format int32 */
  totalMaps?: number;
  /** @format int32 */
  totalPlaylists?: number;
  /** @format int32 */
  totalUpvotes?: number;
}
