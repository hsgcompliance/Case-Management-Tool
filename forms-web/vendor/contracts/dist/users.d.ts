import { z } from "./core.js";
/** Org-level role tags (NOT ladder). */
export declare const RoleTagCanonical: z.ZodEnum<{
    casemanager: "casemanager";
    compliance: "compliance";
    viewer: "viewer";
}>;
/** API-settable ladder levels that admins may set through admin endpoints. */
export declare const TopRoleCanonical: z.ZodEnum<{
    admin: "admin";
    user: "user";
    viewer: "viewer";
    dev: "dev";
    org_dev: "org_dev";
    super_dev: "super_dev";
}>;
export type TRoleTag = z.infer<typeof RoleTagCanonical>;
/** Full ladder used in claims/identity flows. */
export declare const TopRoleLadder: z.ZodEnum<{
    admin: "admin";
    user: "user";
    viewer: "viewer";
    dev: "dev";
    org_dev: "org_dev";
    super_dev: "super_dev";
    unverified: "unverified";
    public_user: "public_user";
}>;
export declare const RoleInput: z.ZodPipe<z.ZodString, z.ZodTransform<any, string>>;
export declare const RolesArray: z.ZodDefault<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<any, string>>>>;
export declare const CreateUserBody: z.ZodObject<{
    email: z.ZodEmail;
    password: z.ZodString;
    name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    roles: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<any, string>>>>>;
    topRole: z.ZodOptional<z.ZodEnum<{
        admin: "admin";
        user: "user";
        viewer: "viewer";
        dev: "dev";
        org_dev: "org_dev";
        super_dev: "super_dev";
    }>>;
    orgId: z.ZodOptional<z.ZodString>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const InviteUserBody: z.ZodObject<{
    email: z.ZodEmail;
    name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    roles: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<any, string>>>>>;
    topRole: z.ZodOptional<z.ZodEnum<{
        admin: "admin";
        user: "user";
        viewer: "viewer";
        dev: "dev";
        org_dev: "org_dev";
        super_dev: "super_dev";
    }>>;
    orgId: z.ZodOptional<z.ZodString>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    sendEmail: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    continueUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const SetRoleBody: z.ZodObject<{
    uid: z.ZodString;
    roles: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<any, string>>>>>;
    topRole: z.ZodOptional<z.ZodEnum<{
        admin: "admin";
        user: "user";
        viewer: "viewer";
        dev: "dev";
        org_dev: "org_dev";
        super_dev: "super_dev";
    }>>;
    orgId: z.ZodOptional<z.ZodString>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const SetActiveBody: z.ZodObject<{
    uid: z.ZodString;
    active: z.ZodBoolean;
}, z.core.$strip>;
export declare const UpdateUserProfileBody: z.ZodObject<{
    uid: z.ZodString;
    displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const ResendInviteBody: z.ZodObject<{
    uid: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodEmail>;
    continueUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const RevokeSessionsBody: z.ZodObject<{
    orgId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TUserListStatus = "all" | "active" | "inactive";
export declare const ListUsersBody: z.ZodObject<{
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    pageToken: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
        all: "all";
    }>>>;
}, z.core.$strip>;
export declare const OrgManagerTeam: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const OrgManagerOrg: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    teams: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>>>>;
    createdAt: z.ZodOptional<z.ZodUnknown>;
    updatedAt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$loose>;
export declare const OrgManagerListOrgsBody: z.ZodObject<{
    includeInactive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const OrgManagerUpsertOrgBody: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const OrgManagerPatchTeamsBody: z.ZodObject<{
    orgId: z.ZodString;
    add: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>]>>>;
    remove: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
/** Flat acuity/caseload fields — promoted to top-level on UserExtras for Firestore indexing. */
export declare const UserMetrics: z.ZodObject<{
    caseloadActive: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    acuityScoreSum: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    acuityScoreCount: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    acuityScoreAvg: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    lastAcuityUpdatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodDate]>>>>;
    enrollmentCount: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
}, z.core.$strip>;
/** Per-user task counts computed by triggers/reconcile — stored as `taskMetrics` on userExtras. */
export declare const UserTaskMetrics: z.ZodObject<{
    openThisMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    openNextMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    byType: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodObject<{
        thisMonth: z.ZodOptional<z.ZodNumber>;
        nextMonth: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
    reconciledAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
}, z.core.$strip>;
/** Per-user payment counts computed by triggers/reconcile — stored as `paymentMetrics` on userExtras. */
export declare const UserPaymentMetrics: z.ZodObject<{
    unpaidThisMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    unpaidNextMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    unpaidTotal: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    amountThisMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    amountNextMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    amountTotal: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
    reconciledAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
}, z.core.$strip>;
export declare const UserSettings: z.ZodObject<{
    pageLayouts: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    dashboardPrefs: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    toolsPrefs: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    spendingViews: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    allowAiAssistance: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    googleIntegrationModes: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        googleCalendar: z.ZodOptional<z.ZodEnum<{
            permanent: "permanent";
            temporary: "temporary";
            off: "off";
        }>>;
        googleDrive: z.ZodOptional<z.ZodEnum<{
            permanent: "permanent";
            temporary: "temporary";
            off: "off";
        }>>;
    }, z.core.$strip>>>;
}, z.core.$catchall<z.ZodUnknown>>;
export declare const UserDigestSubs: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export declare const UserPinnedItem: z.ZodObject<{
    type: z.ZodString;
    id: z.ZodString;
}, z.core.$loose>;
/** Dashboard UI preferences stored as `dashboardPrefs` on userExtras. */
export declare const UserDashboardPrefs: z.ZodObject<{
    activeToolId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    pinnedToolIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
    recency: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
}, z.core.$strip>;
/** Preferred customers page experience stored on `userExtras`. */
export declare const UserCustomersPageMode: z.ZodEnum<{
    new: "new";
    legacy: "legacy";
}>;
/**
 * User-level grant pin preferences stored as `grantPrefs` on userExtras.
 * Distinct from system/org pins on the grant doc itself (those live in grant.pins).
 *
 *   pinnedGrantIds       — grants pinned to the grants-page detail card strip (max 6)
 *   metricsPinnedGrantId — single grant pinned to the user's metrics bar/strip
 */
export declare const UserGrantPrefs: z.ZodObject<{
    pinnedGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    metricsPinnedGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updatedAt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$loose>;
export type TUserGrantPrefs = z.infer<typeof UserGrantPrefs>;
export declare const TourProgressStatus: z.ZodEnum<{
    completed: "completed";
    in_progress: "in_progress";
    abandoned: "abandoned";
}>;
export declare const TourProgressEntry: z.ZodObject<{
    stepIndex: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<{
        completed: "completed";
        in_progress: "in_progress";
        abandoned: "abandoned";
    }>>;
    updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>]>>;
}, z.core.$strip>;
export declare const UserToursState: z.ZodObject<{
    progress: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        stepIndex: z.ZodOptional<z.ZodNumber>;
        status: z.ZodOptional<z.ZodEnum<{
            completed: "completed";
            in_progress: "in_progress";
            abandoned: "abandoned";
        }>>;
        updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>]>>;
    }, z.core.$strip>>>>;
    dismissedAllPrompt: z.ZodOptional<z.ZodBoolean>;
    updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
}, z.core.$strip>;
export declare const UserGameRecord: z.ZodObject<{
    highScore: z.ZodOptional<z.ZodNumber>;
    lastPlayed: z.ZodOptional<z.ZodString>;
    gamesPlayed: z.ZodOptional<z.ZodNumber>;
}, z.core.$catchall<z.ZodUnknown>>;
export declare const UserGameMeta: z.ZodRecord<z.ZodString, z.ZodObject<{
    highScore: z.ZodOptional<z.ZodNumber>;
    lastPlayed: z.ZodOptional<z.ZodString>;
    gamesPlayed: z.ZodOptional<z.ZodNumber>;
}, z.core.$catchall<z.ZodUnknown>>>;
export declare const UserGameHighScores: z.ZodObject<{
    runner: z.ZodOptional<z.ZodNumber>;
    snake: z.ZodOptional<z.ZodNumber>;
    space_invaders: z.ZodOptional<z.ZodNumber>;
    tower_defense_round: z.ZodOptional<z.ZodNumber>;
}, z.core.$catchall<z.ZodNumber>>;
export declare const GoogleCalendarIntegration: z.ZodObject<{
    connected: z.ZodBoolean;
    googleEmail: z.ZodOptional<z.ZodString>;
    scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    connectedAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
    lastSyncAt: z.ZodOptional<z.ZodString>;
    accessTokenExpiresAt: z.ZodOptional<z.ZodString>;
    permissionStatus: z.ZodEnum<{
        error: "error";
        connected: "connected";
        needs_reconnect: "needs_reconnect";
        revoked: "revoked";
        disconnected: "disconnected";
    }>;
}, z.core.$strip>;
export declare const GoogleDriveIntegration: z.ZodObject<{
    connected: z.ZodBoolean;
    googleEmail: z.ZodOptional<z.ZodString>;
    scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    connectedAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
    accessTokenExpiresAt: z.ZodOptional<z.ZodString>;
    permissionStatus: z.ZodEnum<{
        error: "error";
        connected: "connected";
        needs_reconnect: "needs_reconnect";
        revoked: "revoked";
        disconnected: "disconnected";
    }>;
}, z.core.$strip>;
export type TGoogleCalendarIntegration = z.infer<typeof GoogleCalendarIntegration>;
export type TGoogleDriveIntegration = z.infer<typeof GoogleDriveIntegration>;
export declare const UserExtras: z.ZodObject<{
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    settings: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        pageLayouts: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        dashboardPrefs: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        toolsPrefs: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        spendingViews: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        allowAiAssistance: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        googleIntegrationModes: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            googleCalendar: z.ZodOptional<z.ZodEnum<{
                permanent: "permanent";
                temporary: "temporary";
                off: "off";
            }>>;
            googleDrive: z.ZodOptional<z.ZodEnum<{
                permanent: "permanent";
                temporary: "temporary";
                off: "off";
            }>>;
        }, z.core.$strip>>>;
    }, z.core.$catchall<z.ZodUnknown>>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    dashboardPrefs: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        activeToolId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        pinnedToolIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
        recency: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
    }, z.core.$strip>>>;
    digestSubs: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    pinnedItems: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        id: z.ZodString;
    }, z.core.$loose>>>>;
    tours: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        progress: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            stepIndex: z.ZodOptional<z.ZodNumber>;
            status: z.ZodOptional<z.ZodEnum<{
                completed: "completed";
                in_progress: "in_progress";
                abandoned: "abandoned";
            }>>;
            updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>]>>;
        }, z.core.$strip>>>>;
        dismissedAllPrompt: z.ZodOptional<z.ZodBoolean>;
        updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>;
    }, z.core.$strip>>>;
    game_meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        highScore: z.ZodOptional<z.ZodNumber>;
        lastPlayed: z.ZodOptional<z.ZodString>;
        gamesPlayed: z.ZodOptional<z.ZodNumber>;
    }, z.core.$catchall<z.ZodUnknown>>>>;
    gameHighScores: z.ZodOptional<z.ZodObject<{
        runner: z.ZodOptional<z.ZodNumber>;
        snake: z.ZodOptional<z.ZodNumber>;
        space_invaders: z.ZodOptional<z.ZodNumber>;
        tower_defense_round: z.ZodOptional<z.ZodNumber>;
    }, z.core.$catchall<z.ZodNumber>>>;
    quickBreakHighScore: z.ZodOptional<z.ZodNumber>;
    grantPrefs: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        pinnedGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
        metricsPinnedGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$loose>>>;
    taskMode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        workflow: "workflow";
        viewer: "viewer";
    }>>>;
    taskModeSetAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    taskModeSetBy: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        admin: "admin";
        system: "system";
        self: "self";
    }>>>;
    digestOptOut: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    digestFrequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        monthly: "monthly";
        off: "off";
    }>>>;
    customersPageMode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        new: "new";
        legacy: "legacy";
    }>>>;
    caseloadActive: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    clientTotal: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    clientActive: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    clientInactive: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    clientPopulationCounts: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    enrollmentCount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    enrollmentActive: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    enrollmentInactive: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    enrollmentPopulationCounts: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    acuityScoreSum: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    acuityScoreCount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    acuityScoreAvg: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    lastAcuityUpdatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodDate]>>>;
    taskMetrics: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        openThisMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        openNextMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        byType: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodObject<{
            thisMonth: z.ZodOptional<z.ZodNumber>;
            nextMonth: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        reconciledAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
    }, z.core.$strip>>>;
    paymentMetrics: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        unpaidThisMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        unpaidNextMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        unpaidTotal: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        amountThisMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        amountNextMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        amountTotal: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        reconciledAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
    }, z.core.$strip>>>;
    integrations: z.ZodOptional<z.ZodObject<{
        googleCalendar: z.ZodOptional<z.ZodObject<{
            connected: z.ZodBoolean;
            googleEmail: z.ZodOptional<z.ZodString>;
            scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
            connectedAt: z.ZodOptional<z.ZodString>;
            updatedAt: z.ZodOptional<z.ZodString>;
            lastSyncAt: z.ZodOptional<z.ZodString>;
            accessTokenExpiresAt: z.ZodOptional<z.ZodString>;
            permissionStatus: z.ZodEnum<{
                error: "error";
                connected: "connected";
                needs_reconnect: "needs_reconnect";
                revoked: "revoked";
                disconnected: "disconnected";
            }>;
        }, z.core.$strip>>;
        googleDrive: z.ZodOptional<z.ZodObject<{
            connected: z.ZodBoolean;
            googleEmail: z.ZodOptional<z.ZodString>;
            scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
            connectedAt: z.ZodOptional<z.ZodString>;
            updatedAt: z.ZodOptional<z.ZodString>;
            accessTokenExpiresAt: z.ZodOptional<z.ZodString>;
            permissionStatus: z.ZodEnum<{
                error: "error";
                connected: "connected";
                needs_reconnect: "needs_reconnect";
                revoked: "revoked";
                disconnected: "disconnected";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strict>;
export declare const UpdateMeBody: z.ZodObject<{
    updates: z.ZodObject<{
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        settings: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            pageLayouts: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            dashboardPrefs: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            toolsPrefs: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            spendingViews: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            allowAiAssistance: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
            googleIntegrationModes: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                googleCalendar: z.ZodOptional<z.ZodEnum<{
                    permanent: "permanent";
                    temporary: "temporary";
                    off: "off";
                }>>;
                googleDrive: z.ZodOptional<z.ZodEnum<{
                    permanent: "permanent";
                    temporary: "temporary";
                    off: "off";
                }>>;
            }, z.core.$strip>>>;
        }, z.core.$catchall<z.ZodUnknown>>>>;
        meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        dashboardPrefs: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            activeToolId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            pinnedToolIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
            recency: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        }, z.core.$strip>>>;
        digestSubs: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        pinnedItems: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            id: z.ZodString;
        }, z.core.$loose>>>>;
        tours: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            progress: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                stepIndex: z.ZodOptional<z.ZodNumber>;
                status: z.ZodOptional<z.ZodEnum<{
                    completed: "completed";
                    in_progress: "in_progress";
                    abandoned: "abandoned";
                }>>;
                updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>]>>;
            }, z.core.$strip>>>>;
            dismissedAllPrompt: z.ZodOptional<z.ZodBoolean>;
            updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>;
        }, z.core.$strip>>>;
        game_meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            highScore: z.ZodOptional<z.ZodNumber>;
            lastPlayed: z.ZodOptional<z.ZodString>;
            gamesPlayed: z.ZodOptional<z.ZodNumber>;
        }, z.core.$catchall<z.ZodUnknown>>>>;
        gameHighScores: z.ZodOptional<z.ZodObject<{
            runner: z.ZodOptional<z.ZodNumber>;
            snake: z.ZodOptional<z.ZodNumber>;
            space_invaders: z.ZodOptional<z.ZodNumber>;
            tower_defense_round: z.ZodOptional<z.ZodNumber>;
        }, z.core.$catchall<z.ZodNumber>>>;
        quickBreakHighScore: z.ZodOptional<z.ZodNumber>;
        grantPrefs: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            pinnedGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
            metricsPinnedGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$loose>>>;
        taskMode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            workflow: "workflow";
            viewer: "viewer";
        }>>>;
        taskModeSetAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        taskModeSetBy: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            admin: "admin";
            system: "system";
            self: "self";
        }>>>;
        digestOptOut: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        digestFrequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            monthly: "monthly";
            off: "off";
        }>>>;
        customersPageMode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            new: "new";
            legacy: "legacy";
        }>>>;
        caseloadActive: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        clientTotal: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        clientActive: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        clientInactive: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        clientPopulationCounts: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        enrollmentCount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        enrollmentActive: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        enrollmentInactive: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        enrollmentPopulationCounts: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        acuityScoreSum: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        acuityScoreCount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        acuityScoreAvg: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        lastAcuityUpdatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodDate]>>>;
        taskMetrics: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            openThisMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            openNextMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            byType: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodObject<{
                thisMonth: z.ZodOptional<z.ZodNumber>;
                nextMonth: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>>>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
            reconciledAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        }, z.core.$strip>>>;
        paymentMetrics: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            unpaidThisMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            unpaidNextMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            unpaidTotal: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            amountThisMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            amountNextMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            amountTotal: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
            reconciledAt: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        }, z.core.$strip>>>;
        integrations: z.ZodOptional<z.ZodObject<{
            googleCalendar: z.ZodOptional<z.ZodObject<{
                connected: z.ZodBoolean;
                googleEmail: z.ZodOptional<z.ZodString>;
                scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
                connectedAt: z.ZodOptional<z.ZodString>;
                updatedAt: z.ZodOptional<z.ZodString>;
                lastSyncAt: z.ZodOptional<z.ZodString>;
                accessTokenExpiresAt: z.ZodOptional<z.ZodString>;
                permissionStatus: z.ZodEnum<{
                    error: "error";
                    connected: "connected";
                    needs_reconnect: "needs_reconnect";
                    revoked: "revoked";
                    disconnected: "disconnected";
                }>;
            }, z.core.$strip>>;
            googleDrive: z.ZodOptional<z.ZodObject<{
                connected: z.ZodBoolean;
                googleEmail: z.ZodOptional<z.ZodString>;
                scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
                connectedAt: z.ZodOptional<z.ZodString>;
                updatedAt: z.ZodOptional<z.ZodString>;
                accessTokenExpiresAt: z.ZodOptional<z.ZodString>;
                permissionStatus: z.ZodEnum<{
                    error: "error";
                    connected: "connected";
                    needs_reconnect: "needs_reconnect";
                    revoked: "revoked";
                    disconnected: "disconnected";
                }>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strict>;
}, z.core.$strip>;
export type TRoles = z.infer<typeof RolesArray>;
export type TTopRole = z.infer<typeof TopRoleCanonical>;
export type TTopRoleLadder = z.infer<typeof TopRoleLadder>;
export type TUserMetrics = z.infer<typeof UserMetrics>;
export type TUserTaskMetrics = z.infer<typeof UserTaskMetrics>;
export type TUserPaymentMetrics = z.infer<typeof UserPaymentMetrics>;
export type TUserSettings = z.infer<typeof UserSettings>;
export type TUserDigestSubs = z.infer<typeof UserDigestSubs>;
export type TUserPinnedItem = z.infer<typeof UserPinnedItem>;
export type TUserDashboardPrefs = z.infer<typeof UserDashboardPrefs>;
export type TUserCustomersPageMode = z.infer<typeof UserCustomersPageMode>;
export type TTourProgressStatus = z.infer<typeof TourProgressStatus>;
export type TTourProgressEntry = z.infer<typeof TourProgressEntry>;
export type TUserToursState = z.infer<typeof UserToursState>;
export type TUserGameRecord = z.infer<typeof UserGameRecord>;
export type TUserGameMeta = z.infer<typeof UserGameMeta>;
export type TUserGameHighScores = z.infer<typeof UserGameHighScores>;
export type TUserExtras = z.infer<typeof UserExtras>;
export type TTaskMode = NonNullable<TUserExtras["taskMode"]>;
export type TTaskModeSetBy = NonNullable<TUserExtras["taskModeSetBy"]>;
export type CreateUserBodyT = z.infer<typeof CreateUserBody>;
export type InviteUserBodyT = z.infer<typeof InviteUserBody>;
export type SetRoleBodyT = z.infer<typeof SetRoleBody>;
export type SetActiveBodyT = z.infer<typeof SetActiveBody>;
export type UpdateUserProfileBodyT = z.infer<typeof UpdateUserProfileBody>;
export type ResendInviteBodyT = z.infer<typeof ResendInviteBody>;
export type RevokeSessionsBodyT = z.infer<typeof RevokeSessionsBody>;
export type ListUsersBodyT = z.infer<typeof ListUsersBody>;
export type OrgManagerTeamT = z.infer<typeof OrgManagerTeam>;
export type OrgManagerOrgT = z.infer<typeof OrgManagerOrg>;
export type OrgManagerListOrgsBodyT = z.infer<typeof OrgManagerListOrgsBody>;
export type OrgManagerUpsertOrgBodyT = z.infer<typeof OrgManagerUpsertOrgBody>;
export type OrgManagerPatchTeamsBodyT = z.infer<typeof OrgManagerPatchTeamsBody>;
export type UpdateMeBodyT = z.infer<typeof UpdateMeBody>;
export type CreateUserBodyIn = z.input<typeof CreateUserBody>;
export type InviteUserBodyIn = z.input<typeof InviteUserBody>;
export type SetRoleBodyIn = z.input<typeof SetRoleBody>;
export type SetActiveBodyIn = z.input<typeof SetActiveBody>;
export type UpdateUserProfileBodyIn = z.input<typeof UpdateUserProfileBody>;
export type ResendInviteBodyIn = z.input<typeof ResendInviteBody>;
export type RevokeSessionsBodyIn = z.input<typeof RevokeSessionsBody>;
export type ListUsersBodyIn = z.input<typeof ListUsersBody>;
export type OrgManagerListOrgsBodyIn = z.input<typeof OrgManagerListOrgsBody>;
export type OrgManagerUpsertOrgBodyIn = z.input<typeof OrgManagerUpsertOrgBody>;
export type OrgManagerPatchTeamsBodyIn = z.input<typeof OrgManagerPatchTeamsBody>;
export type UpdateMeBodyIn = z.input<typeof UpdateMeBody>;
/** Tags + canonical ladder values that FE/API care about. */
export type TRole = TRoleTag | TTopRole;
/**
 * Shape used by API responses. Keep permissive: functions may attach extra fields.
 * (Do NOT over-tighten this; endpointMap is just the wire surface.)
 */
export type UserComposite = {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    phone?: string | null;
    disabled?: boolean;
    active?: boolean;
    roles?: string[];
    topRole?: string;
    createdAt?: string | null;
    lastLogin?: string | null;
    extras?: TUserExtras | Record<string, unknown> | null;
    [k: string]: unknown;
};
