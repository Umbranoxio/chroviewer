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

export type LeaderboardControllerGetDifficultiesForHashData = {
  difficulty: number;
  gameMode: string;
  id: number;
  rawDifficulty: string;
}[];

export interface LeaderboardControllerGetLeaderboardByIdData {
  createdAt: string;
  dailyScores: number;
  difficulty: {
    difficulty: number;
    gameMode: string;
    id: number;
    rawDifficulty: string;
  };
  id: number;
  map: {
    bpm: number;
    bsid: string | null;
    coverUrl: string;
    hash: string;
    id: number;
    levelAuthorName: string;
    songAuthorName: string;
    songName: string;
    songSubName: string;
    verified: boolean;
  };
  maxScore: number;
  realm: {
    leaderboardStatus: "UNRANKED" | "RANKED" | "QUALIFIED" | "LOVED";
    lovedAt: string | null;
    positiveModifiers: boolean;
    qualifiedAt: string | null;
    rankedAt: string | null;
    realmId: number;
    realmName: string;
    stars: number;
  };
  totalScores: number;
}

export interface PlayerControllerGetPlayerData {
  avatar: string;
  avatarVersion: number;
  badges: {
    description: string;
    id: number;
    image: string;
  }[];
  banned: boolean;
  bio: string | null;
  country: string;
  createdAt: string;
  followers: number;
  following: number;
  id: string;
  inactive: boolean;
  lastSeenAt: string;
  name: string;
  permissions: number;
  pinnedScores: {
    comment: string;
    score: {
      leaderboard: {
        createdAt: string;
        dailyScores: number;
        difficulty: {
          difficulty: number;
          gameMode: string;
          id: number;
          rawDifficulty: string;
        };
        id: number;
        map: {
          bpm: number;
          bsid: string | null;
          coverUrl: string;
          hash: string;
          id: number;
          levelAuthorName: string;
          songAuthorName: string;
          songName: string;
          songSubName: string;
          verified: boolean;
        };
        maxScore: number;
        realm: {
          leaderboardStatus: "UNRANKED" | "RANKED" | "QUALIFIED" | "LOVED";
          lovedAt: string | null;
          positiveModifiers: boolean;
          qualifiedAt: string | null;
          rankedAt: string | null;
          realmId: number;
          realmName: string;
          stars: number;
        };
        totalScores: number;
      };
      score: {
        accuracy: number;
        badCuts: number;
        createdAt: string;
        device: {
          controllerLeft: string | null;
          controllerRight: string | null;
          hmd: string | null;
        } | null;
        fullCombo: boolean;
        hasHistory?: boolean;
        hasReplay: boolean;
        id: number;
        legacyHmdId: number | null;
        maxCombo: number;
        missedNotes: number;
        modifiedScore: number;
        mods: string[];
        personalBest: boolean;
        playOutcome: "CLEAR" | "FAIL" | "QUIT" | "RESTART";
        playOutcomeTime: number | null;
        player: {
          avatar: string;
          avatarVersion: number;
          country: string;
          id: string;
          name: string;
          permissions: number;
          playerNameInGame: string;
          role: string | null;
        };
        pp: number;
        rank: number;
        replayViewCount?: number;
        unmodifiedScore: number;
        version: string | null;
        weight: number;
      };
    };
  }[];
  playerNameInGame: string;
  profileCustomization: {
    accentColor: string | null;
    accentForegroundActiveColor: string | null;
    accentForegroundColor: string | null;
    backgroundImage: string | null;
    backgroundImageVersion: number | null;
    badgeComments: Record<string, string> | null;
    badgeOrder: number[] | null;
    chartMetricIds:
      | ("rank" | "totalPP" | "averageAccuracy" | "totalSubmittedPlays")[]
      | null;
    enabledStatIds:
      | (
          | "rankedPlays"
          | "rankedScore"
          | "rankedAcc"
          | "plusOnePP"
          | "totalPlays"
          | "totalScore"
          | "joined"
          | "replayViews"
          | "role"
        )[]
      | null;
    sectionOrder: ("charts" | "bio" | "pinnedScores" | "scores")[] | null;
    statOrder:
      | (
          | "rankedPlays"
          | "rankedScore"
          | "rankedAcc"
          | "plusOnePP"
          | "totalPlays"
          | "totalScore"
          | "joined"
          | "replayViews"
          | "role"
        )[]
      | null;
    supporterNameColorEnabled: boolean;
  };
  role: string | null;
  silenced: boolean;
  stats: {
    averageAccuracy: number;
    completionAccuracy: number;
    countryRank: number;
    device: {
      controllerLeft: string | null;
      controllerRight: string | null;
      hmd: string | null;
    } | null;
    plusOnePP: number | null;
    rank: number;
    rankChange: number | null;
    realmId: number;
    realmName: string;
    totalPP: number;
    totalPlayedLeaderboards: number;
    totalPlayedRankedLeaderboards: number;
    totalRankedScore: string;
    totalReplayViews: number;
    totalScore: string;
    totalSubmittedPlays: number;
    weightedAverageAccuracy: number;
  };
  vanity: string | null;
}

export interface PlayerControllerGetPlayerScoresData {
  data: {
    leaderboard: {
      createdAt: string;
      dailyScores: number;
      difficulty: {
        difficulty: number;
        gameMode: string;
        id: number;
        rawDifficulty: string;
      };
      id: number;
      map: {
        bpm: number;
        bsid: string | null;
        coverUrl: string;
        hash: string;
        id: number;
        levelAuthorName: string;
        songAuthorName: string;
        songName: string;
        songSubName: string;
        verified: boolean;
      };
      maxScore: number;
      realm: {
        leaderboardStatus: "UNRANKED" | "RANKED" | "QUALIFIED" | "LOVED";
        lovedAt: string | null;
        positiveModifiers: boolean;
        qualifiedAt: string | null;
        rankedAt: string | null;
        realmId: number;
        realmName: string;
        stars: number;
      };
      totalScores: number;
    };
    score: {
      accuracy: number;
      badCuts: number;
      createdAt: string;
      device: {
        controllerLeft: string | null;
        controllerRight: string | null;
        hmd: string | null;
      } | null;
      fullCombo: boolean;
      hasHistory?: boolean;
      hasReplay: boolean;
      id: number;
      legacyHmdId: number | null;
      maxCombo: number;
      missedNotes: number;
      modifiedScore: number;
      mods: string[];
      personalBest: boolean;
      playOutcome: "CLEAR" | "FAIL" | "QUIT" | "RESTART";
      playOutcomeTime: number | null;
      player: {
        avatar: string;
        avatarVersion: number;
        country: string;
        id: string;
        name: string;
        permissions: number;
        playerNameInGame: string;
        role: string | null;
      };
      pp: number;
      rank: number;
      replayViewCount?: number;
      unmodifiedScore: number;
      version: string | null;
      weight: number;
    };
  }[];
  metadata: {
    itemsPerPage: number;
    page: number;
    totalItems: number;
    totalPages: number;
  };
}

/** @format binary */
export type ScoreControllerDownloadReplayData = File;

export interface ScoreControllerGetScoreData {
  leaderboard: {
    createdAt: string;
    dailyScores: number;
    difficulty: {
      difficulty: number;
      gameMode: string;
      id: number;
      rawDifficulty: string;
    };
    id: number;
    map: {
      bpm: number;
      bsid: string | null;
      coverUrl: string;
      hash: string;
      id: number;
      levelAuthorName: string;
      songAuthorName: string;
      songName: string;
      songSubName: string;
      verified: boolean;
    };
    maxScore: number;
    realm: {
      leaderboardStatus: "UNRANKED" | "RANKED" | "QUALIFIED" | "LOVED";
      lovedAt: string | null;
      positiveModifiers: boolean;
      qualifiedAt: string | null;
      rankedAt: string | null;
      realmId: number;
      realmName: string;
      stars: number;
    };
    totalScores: number;
  };
  score: {
    accuracy: number;
    badCuts: number;
    createdAt: string;
    device: {
      controllerLeft: string | null;
      controllerRight: string | null;
      hmd: string | null;
    } | null;
    fullCombo: boolean;
    hasHistory?: boolean;
    hasReplay: boolean;
    id: number;
    legacyHmdId: number | null;
    maxCombo: number;
    missedNotes: number;
    modifiedScore: number;
    mods: string[];
    personalBest: boolean;
    playOutcome: "CLEAR" | "FAIL" | "QUIT" | "RESTART";
    playOutcomeTime: number | null;
    player: {
      avatar: string;
      avatarVersion: number;
      country: string;
      id: string;
      name: string;
      permissions: number;
      playerNameInGame: string;
      role: string | null;
    };
    pp: number;
    rank: number;
    replayViewCount?: number;
    unmodifiedScore: number;
    version: string | null;
    weight: number;
  };
  scoreStats: {
    max115Streak: number | null;
    accLeft: number;
    accRight: number;
    accuracyDistribution: {
      leftCount: number[];
      leftTd: (number | null)[];
      leftTotal: number;
      rightCount: number[];
      rightTd: (number | null)[];
      rightTotal: number;
      timingStdDev: (number | null)[];
    };
    accuracyTimeline: {
      left: {
        actual: number[];
        fullSwing: number[];
      };
      right: {
        actual: number[];
        fullSwing: number[];
      };
      times: number[];
      total: {
        actual: number[];
        fullSwing: number[];
      };
    };
    averageHeadPosition: {
      x: number;
      y: number;
      z: number;
    };
    averageHeight: number;
    endTime: number;
    failTime: number;
    fcAcc: number;
    gridCutDetails: {
      grid: {
        avgScore: number;
        count: number;
        left: {
          avgScore: number;
          count: number;
        }[];
        right: {
          avgScore: number;
          count: number;
        }[];
      }[];
      summaryGrids: {
        avgScore: number;
        count: number;
      }[][];
    };
    handSummary: {
      label: string;
      left: {
        avgScore: number;
        avgTd: number;
        count: number;
      };
      right: {
        avgScore: number;
        avgTd: number;
        count: number;
      };
    }[];
    jumpDistance?: number;
    /**
     * @maxItems 3
     * @minItems 3
     */
    leftAverageCut: number[];
    leftBadCuts: number;
    leftBombs: number;
    leftMiss: number;
    leftPostswing: number;
    leftPreswing: number;
    leftSaberHitOffset: number;
    leftTimeDependence: number;
    leftTiming: number;
    maxCombo: number;
    maxScore: number;
    noteSpawnOffset: number;
    passed: boolean;
    pauseCount?: number;
    pauseTotalDurationSeconds?: number;
    /**
     * @maxItems 3
     * @minItems 3
     */
    rightAverageCut: number[];
    rightBadCuts: number;
    rightBombs: number;
    rightMiss: number;
    rightPostswing: number;
    rightPreswing: number;
    rightSaberHitOffset: number;
    rightTimeDependence: number;
    rightTiming: number;
    scoreGraph: number[];
    totalScore: number;
    underswingStats: {
      count: number;
      fcAcc: number;
      fcScore: number;
      fullSwingAcc: number;
      fullSwingFcAcc: number;
      fullSwingFcScore: number;
      fullSwingScore: number;
      maxCutScore: number;
    };
  } | null;
}
