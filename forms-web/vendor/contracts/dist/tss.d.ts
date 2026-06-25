import { z } from "./core.js";
export declare const TssWorkbookVariantSchema: z.ZodEnum<{
    unknown: "unknown";
    payer: "payer";
    nonPayer: "nonPayer";
}>;
export type TssWorkbookVariant = z.infer<typeof TssWorkbookVariantSchema>;
export declare const TssDirectionSchema: z.ZodEnum<{
    worksheetToApp: "worksheetToApp";
    appToWorksheet: "appToWorksheet";
    bidirectional: "bidirectional";
}>;
export type TssDirection = z.infer<typeof TssDirectionSchema>;
export declare const TssDataTypeSchema: z.ZodEnum<{
    string: "string";
    number: "number";
    date: "date";
    computed: "computed";
    url: "url";
    duration: "duration";
    currency: "currency";
    select: "select";
    longText: "longText";
    time: "time";
    signature: "signature";
}>;
export type TssDataType = z.infer<typeof TssDataTypeSchema>;
export declare const TssRenderKindSchema: z.ZodEnum<{
    keyValueCard: "keyValueCard";
    summaryBox: "summaryBox";
    sectionedTable: "sectionedTable";
    dataTable: "dataTable";
    budgetTable: "budgetTable";
    acronymCard: "acronymCard";
}>;
export type TssRenderKind = z.infer<typeof TssRenderKindSchema>;
export declare const TssSheetResolutionModeSchema: z.ZodEnum<{
    exactOrAlias: "exactOrAlias";
    containsAnyAlias: "containsAnyAlias";
    anchorScanFallback: "anchorScanFallback";
}>;
export type TssSheetResolutionMode = z.infer<typeof TssSheetResolutionModeSchema>;
export declare const TssHeaderResolutionModeSchema: z.ZodEnum<{
    fixedRowPreferred: "fixedRowPreferred";
    anchorThenOffset: "anchorThenOffset";
    scanWindow: "scanWindow";
}>;
export type TssHeaderResolutionMode = z.infer<typeof TssHeaderResolutionModeSchema>;
export declare const TssEntitySectionSchema: z.ZodEnum<{
    notes: "notes";
    budget: "budget";
    cover: "cover";
    housingPlan: "housingPlan";
    reference: "reference";
}>;
export type TssEntitySection = z.infer<typeof TssEntitySectionSchema>;
export declare const TssSmartHeaderConfigSchema: z.ZodObject<{
    id: z.ZodString;
    expected: z.ZodString;
    aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
    required: z.ZodOptional<z.ZodBoolean>;
    dataType: z.ZodOptional<z.ZodEnum<{
        string: "string";
        number: "number";
        date: "date";
        computed: "computed";
        url: "url";
        duration: "duration";
        currency: "currency";
        select: "select";
        longText: "longText";
        time: "time";
        signature: "signature";
    }>>;
    optionSourceId: z.ZodOptional<z.ZodString>;
    appField: z.ZodOptional<z.ZodString>;
    clientDocField: z.ZodOptional<z.ZodString>;
    display: z.ZodOptional<z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        width: z.ZodOptional<z.ZodEnum<{
            sm: "sm";
            md: "md";
            lg: "lg";
            xs: "xs";
            xl: "xl";
        }>>;
        multiline: z.ZodOptional<z.ZodBoolean>;
        hideInCompact: z.ZodOptional<z.ZodBoolean>;
        badge: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>;
    write: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        lockIfFormula: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>;
}, z.core.$loose>;
export type TssSmartHeaderConfig = z.infer<typeof TssSmartHeaderConfigSchema>;
export declare const TssSheetConfigSchema: z.ZodObject<{
    id: z.ZodString;
    expectedNames: z.ZodArray<z.ZodString>;
    aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
    hidden: z.ZodOptional<z.ZodBoolean>;
    resolutionMode: z.ZodEnum<{
        exactOrAlias: "exactOrAlias";
        containsAnyAlias: "containsAnyAlias";
        anchorScanFallback: "anchorScanFallback";
    }>;
    headerIdStrategy: z.ZodOptional<z.ZodObject<{
        normalize: z.ZodLiteral<"smartHeaderIdV1">;
        collisionPolicy: z.ZodEnum<{
            preferExactThenAliasThenLeftmost: "preferExactThenAliasThenLeftmost";
            throw: "throw";
        }>;
    }, z.core.$loose>>;
}, z.core.$loose>;
export type TssSheetConfig = z.infer<typeof TssSheetConfigSchema>;
export declare const TssTableRangeConfigSchema: z.ZodObject<{
    sheetId: z.ZodString;
    anchorText: z.ZodOptional<z.ZodString>;
    headerRow: z.ZodOptional<z.ZodNumber>;
    headerRowCandidates: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    headerScan: z.ZodOptional<z.ZodObject<{
        mode: z.ZodEnum<{
            fixedRowPreferred: "fixedRowPreferred";
            anchorThenOffset: "anchorThenOffset";
            scanWindow: "scanWindow";
        }>;
        minRow: z.ZodNumber;
        maxRow: z.ZodNumber;
        mustContainHeaderIds: z.ZodArray<z.ZodString>;
        scoreHeaderIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$loose>>;
    dataStartRowOffset: z.ZodOptional<z.ZodNumber>;
    dataStartRow: z.ZodOptional<z.ZodNumber>;
    dataEnd: z.ZodOptional<z.ZodObject<{
        mode: z.ZodEnum<{
            firstBlankRow: "firstBlankRow";
            untilNextAnchor: "untilNextAnchor";
            fixedRow: "fixedRow";
            worksheetUsedRange: "worksheetUsedRange";
        }>;
        fixedRow: z.ZodOptional<z.ZodNumber>;
        nextAnchorText: z.ZodOptional<z.ZodString>;
        minConsecutiveBlankRows: z.ZodOptional<z.ZodNumber>;
    }, z.core.$loose>>;
    expectedColumns: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>;
export type TssTableRangeConfig = z.infer<typeof TssTableRangeConfigSchema>;
export declare const TssKeyValueCellConfigSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
    appField: z.ZodString;
    clientDocField: z.ZodOptional<z.ZodString>;
    dataType: z.ZodEnum<{
        string: "string";
        number: "number";
        date: "date";
        computed: "computed";
        url: "url";
        duration: "duration";
        currency: "currency";
        select: "select";
        longText: "longText";
        time: "time";
        signature: "signature";
    }>;
    sheetLabelCell: z.ZodOptional<z.ZodString>;
    sheetValueCell: z.ZodOptional<z.ZodString>;
    labelSearch: z.ZodOptional<z.ZodObject<{
        sheetId: z.ZodString;
        labelAliases: z.ZodArray<z.ZodString>;
        scanRange: z.ZodString;
        valueOffset: z.ZodOptional<z.ZodObject<{
            rows: z.ZodNumber;
            cols: z.ZodNumber;
        }, z.core.$strip>>;
        fallbackValueOffsets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            rows: z.ZodNumber;
            cols: z.ZodNumber;
        }, z.core.$strip>>>;
    }, z.core.$loose>>;
    tunnelToClientDoc: z.ZodOptional<z.ZodBoolean>;
    required: z.ZodOptional<z.ZodBoolean>;
}, z.core.$loose>;
export type TssKeyValueCellConfig = z.infer<typeof TssKeyValueCellConfigSchema>;
export declare const TssDisplayEntityConfigSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    section: z.ZodEnum<{
        notes: "notes";
        budget: "budget";
        cover: "cover";
        housingPlan: "housingPlan";
        reference: "reference";
    }>;
    renderKind: z.ZodEnum<{
        keyValueCard: "keyValueCard";
        summaryBox: "summaryBox";
        sectionedTable: "sectionedTable";
        dataTable: "dataTable";
        budgetTable: "budgetTable";
        acronymCard: "acronymCard";
    }>;
    direction: z.ZodEnum<{
        worksheetToApp: "worksheetToApp";
        appToWorksheet: "appToWorksheet";
        bidirectional: "bidirectional";
    }>;
    source: z.ZodObject<{
        sheetId: z.ZodOptional<z.ZodString>;
        range: z.ZodOptional<z.ZodObject<{
            sheetId: z.ZodString;
            anchorText: z.ZodOptional<z.ZodString>;
            headerRow: z.ZodOptional<z.ZodNumber>;
            headerRowCandidates: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
            headerScan: z.ZodOptional<z.ZodObject<{
                mode: z.ZodEnum<{
                    fixedRowPreferred: "fixedRowPreferred";
                    anchorThenOffset: "anchorThenOffset";
                    scanWindow: "scanWindow";
                }>;
                minRow: z.ZodNumber;
                maxRow: z.ZodNumber;
                mustContainHeaderIds: z.ZodArray<z.ZodString>;
                scoreHeaderIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$loose>>;
            dataStartRowOffset: z.ZodOptional<z.ZodNumber>;
            dataStartRow: z.ZodOptional<z.ZodNumber>;
            dataEnd: z.ZodOptional<z.ZodObject<{
                mode: z.ZodEnum<{
                    firstBlankRow: "firstBlankRow";
                    untilNextAnchor: "untilNextAnchor";
                    fixedRow: "fixedRow";
                    worksheetUsedRange: "worksheetUsedRange";
                }>;
                fixedRow: z.ZodOptional<z.ZodNumber>;
                nextAnchorText: z.ZodOptional<z.ZodString>;
                minConsecutiveBlankRows: z.ZodOptional<z.ZodNumber>;
            }, z.core.$loose>>;
            expectedColumns: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$loose>>;
        keyValues: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
            appField: z.ZodString;
            clientDocField: z.ZodOptional<z.ZodString>;
            dataType: z.ZodEnum<{
                string: "string";
                number: "number";
                date: "date";
                computed: "computed";
                url: "url";
                duration: "duration";
                currency: "currency";
                select: "select";
                longText: "longText";
                time: "time";
                signature: "signature";
            }>;
            sheetLabelCell: z.ZodOptional<z.ZodString>;
            sheetValueCell: z.ZodOptional<z.ZodString>;
            labelSearch: z.ZodOptional<z.ZodObject<{
                sheetId: z.ZodString;
                labelAliases: z.ZodArray<z.ZodString>;
                scanRange: z.ZodString;
                valueOffset: z.ZodOptional<z.ZodObject<{
                    rows: z.ZodNumber;
                    cols: z.ZodNumber;
                }, z.core.$strip>>;
                fallbackValueOffsets: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    rows: z.ZodNumber;
                    cols: z.ZodNumber;
                }, z.core.$strip>>>;
            }, z.core.$loose>>;
            tunnelToClientDoc: z.ZodOptional<z.ZodBoolean>;
            required: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>;
        staticContent: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$loose>;
    fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        expected: z.ZodString;
        aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
        required: z.ZodOptional<z.ZodBoolean>;
        dataType: z.ZodOptional<z.ZodEnum<{
            string: "string";
            number: "number";
            date: "date";
            computed: "computed";
            url: "url";
            duration: "duration";
            currency: "currency";
            select: "select";
            longText: "longText";
            time: "time";
            signature: "signature";
        }>>;
        optionSourceId: z.ZodOptional<z.ZodString>;
        appField: z.ZodOptional<z.ZodString>;
        clientDocField: z.ZodOptional<z.ZodString>;
        display: z.ZodOptional<z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            width: z.ZodOptional<z.ZodEnum<{
                sm: "sm";
                md: "md";
                lg: "lg";
                xs: "xs";
                xl: "xl";
            }>>;
            multiline: z.ZodOptional<z.ZodBoolean>;
            hideInCompact: z.ZodOptional<z.ZodBoolean>;
            badge: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>;
        write: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            lockIfFormula: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>;
    }, z.core.$loose>>>;
    dropdowns: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    display: z.ZodOptional<z.ZodObject<{
        titleField: z.ZodOptional<z.ZodString>;
        subtitleField: z.ZodOptional<z.ZodString>;
        emptyState: z.ZodOptional<z.ZodString>;
        compactFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
        sort: z.ZodOptional<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            direction: z.ZodEnum<{
                asc: "asc";
                desc: "desc";
            }>;
        }, z.core.$strip>>>;
        groupBy: z.ZodOptional<z.ZodString>;
        totalFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$loose>>;
    variantOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        source: z.ZodOptional<z.ZodObject<{
            sheetId: z.ZodOptional<z.ZodString>;
            range: z.ZodOptional<z.ZodObject<{
                sheetId: z.ZodString;
                anchorText: z.ZodOptional<z.ZodString>;
                headerRow: z.ZodOptional<z.ZodNumber>;
                headerRowCandidates: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
                headerScan: z.ZodOptional<z.ZodObject<{
                    mode: z.ZodEnum<{
                        fixedRowPreferred: "fixedRowPreferred";
                        anchorThenOffset: "anchorThenOffset";
                        scanWindow: "scanWindow";
                    }>;
                    minRow: z.ZodNumber;
                    maxRow: z.ZodNumber;
                    mustContainHeaderIds: z.ZodArray<z.ZodString>;
                    scoreHeaderIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
                }, z.core.$loose>>;
                dataStartRowOffset: z.ZodOptional<z.ZodNumber>;
                dataStartRow: z.ZodOptional<z.ZodNumber>;
                dataEnd: z.ZodOptional<z.ZodObject<{
                    mode: z.ZodEnum<{
                        firstBlankRow: "firstBlankRow";
                        untilNextAnchor: "untilNextAnchor";
                        fixedRow: "fixedRow";
                        worksheetUsedRange: "worksheetUsedRange";
                    }>;
                    fixedRow: z.ZodOptional<z.ZodNumber>;
                    nextAnchorText: z.ZodOptional<z.ZodString>;
                    minConsecutiveBlankRows: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>;
                expectedColumns: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$loose>>;
            keyValues: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
                appField: z.ZodString;
                clientDocField: z.ZodOptional<z.ZodString>;
                dataType: z.ZodEnum<{
                    string: "string";
                    number: "number";
                    date: "date";
                    computed: "computed";
                    url: "url";
                    duration: "duration";
                    currency: "currency";
                    select: "select";
                    longText: "longText";
                    time: "time";
                    signature: "signature";
                }>;
                sheetLabelCell: z.ZodOptional<z.ZodString>;
                sheetValueCell: z.ZodOptional<z.ZodString>;
                labelSearch: z.ZodOptional<z.ZodObject<{
                    sheetId: z.ZodString;
                    labelAliases: z.ZodArray<z.ZodString>;
                    scanRange: z.ZodString;
                    valueOffset: z.ZodOptional<z.ZodObject<{
                        rows: z.ZodNumber;
                        cols: z.ZodNumber;
                    }, z.core.$strip>>;
                    fallbackValueOffsets: z.ZodOptional<z.ZodArray<z.ZodObject<{
                        rows: z.ZodNumber;
                        cols: z.ZodNumber;
                    }, z.core.$strip>>>;
                }, z.core.$loose>>;
                tunnelToClientDoc: z.ZodOptional<z.ZodBoolean>;
                required: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>;
            staticContent: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$loose>>;
        fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            expected: z.ZodString;
            aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
            required: z.ZodOptional<z.ZodBoolean>;
            dataType: z.ZodOptional<z.ZodEnum<{
                string: "string";
                number: "number";
                date: "date";
                computed: "computed";
                url: "url";
                duration: "duration";
                currency: "currency";
                select: "select";
                longText: "longText";
                time: "time";
                signature: "signature";
            }>>;
            optionSourceId: z.ZodOptional<z.ZodString>;
            appField: z.ZodOptional<z.ZodString>;
            clientDocField: z.ZodOptional<z.ZodString>;
            display: z.ZodOptional<z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                width: z.ZodOptional<z.ZodEnum<{
                    sm: "sm";
                    md: "md";
                    lg: "lg";
                    xs: "xs";
                    xl: "xl";
                }>>;
                multiline: z.ZodOptional<z.ZodBoolean>;
                hideInCompact: z.ZodOptional<z.ZodBoolean>;
                badge: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>;
            write: z.ZodOptional<z.ZodObject<{
                enabled: z.ZodBoolean;
                lockIfFormula: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>;
        }, z.core.$loose>>>;
        display: z.ZodOptional<z.ZodObject<{
            titleField: z.ZodOptional<z.ZodString>;
            subtitleField: z.ZodOptional<z.ZodString>;
            emptyState: z.ZodOptional<z.ZodString>;
            compactFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            sort: z.ZodOptional<z.ZodArray<z.ZodObject<{
                field: z.ZodString;
                direction: z.ZodEnum<{
                    asc: "asc";
                    desc: "desc";
                }>;
            }, z.core.$strip>>>;
            groupBy: z.ZodOptional<z.ZodString>;
            totalFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$loose>>;
    }, z.core.$loose>>>;
}, z.core.$loose>;
export type TssDisplayEntityConfig = z.infer<typeof TssDisplayEntityConfigSchema>;
export declare const TssSheetDropdownListSchema: z.ZodObject<{
    id: z.ZodString;
    sheetId: z.ZodString;
    namedRange: z.ZodString;
    expectedHeader: z.ZodString;
    expectedColumn: z.ZodString;
    values: z.ZodArray<z.ZodString>;
}, z.core.$loose>;
export declare const TssInlineDropdownListSchema: z.ZodObject<{
    id: z.ZodString;
    inlineValues: z.ZodLiteral<true>;
    values: z.ZodArray<z.ZodString>;
}, z.core.$loose>;
export declare const TssDropdownListSchema: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodString;
    sheetId: z.ZodString;
    namedRange: z.ZodString;
    expectedHeader: z.ZodString;
    expectedColumn: z.ZodString;
    values: z.ZodArray<z.ZodString>;
}, z.core.$loose>, z.ZodObject<{
    id: z.ZodString;
    inlineValues: z.ZodLiteral<true>;
    values: z.ZodArray<z.ZodString>;
}, z.core.$loose>]>;
export type TssDropdownList = z.infer<typeof TssDropdownListSchema>;
export declare const TssVariantRuleSchema: z.ZodObject<{
    variant: z.ZodEnum<{
        unknown: "unknown";
        payer: "payer";
        nonPayer: "nonPayer";
    }>;
    ifSheetExists: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type TssVariantRule = z.infer<typeof TssVariantRuleSchema>;
export declare const TssParsingDefaultsSchema: z.ZodObject<{
    rowDriftTolerance: z.ZodOptional<z.ZodNumber>;
    emptyRowPolicy: z.ZodOptional<z.ZodString>;
    mergedCellPolicy: z.ZodOptional<z.ZodString>;
    coverSheetTunnelPolicy: z.ZodOptional<z.ZodString>;
    datePolicy: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type TssParsingDefaults = z.infer<typeof TssParsingDefaultsSchema>;
export declare const TssWorksheetConfigSchema: z.ZodObject<{
    version: z.ZodString;
    workbookKind: z.ZodString;
    smartHeaderIdVersion: z.ZodString;
    sheets: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        expectedNames: z.ZodArray<z.ZodString>;
        aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
        hidden: z.ZodOptional<z.ZodBoolean>;
        resolutionMode: z.ZodEnum<{
            exactOrAlias: "exactOrAlias";
            containsAnyAlias: "containsAnyAlias";
            anchorScanFallback: "anchorScanFallback";
        }>;
        headerIdStrategy: z.ZodOptional<z.ZodObject<{
            normalize: z.ZodLiteral<"smartHeaderIdV1">;
            collisionPolicy: z.ZodEnum<{
                preferExactThenAliasThenLeftmost: "preferExactThenAliasThenLeftmost";
                throw: "throw";
            }>;
        }, z.core.$loose>>;
    }, z.core.$loose>>;
    variantRules: z.ZodArray<z.ZodObject<{
        variant: z.ZodEnum<{
            unknown: "unknown";
            payer: "payer";
            nonPayer: "nonPayer";
        }>;
        ifSheetExists: z.ZodString;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>>;
    dropdownLists: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        id: z.ZodString;
        sheetId: z.ZodString;
        namedRange: z.ZodString;
        expectedHeader: z.ZodString;
        expectedColumn: z.ZodString;
        values: z.ZodArray<z.ZodString>;
    }, z.core.$loose>, z.ZodObject<{
        id: z.ZodString;
        inlineValues: z.ZodLiteral<true>;
        values: z.ZodArray<z.ZodString>;
    }, z.core.$loose>]>>;
    headerAliases: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodArray<z.ZodString>, z.ZodReadonly<z.ZodArray<z.ZodString>>]>>;
    entities: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        section: z.ZodEnum<{
            notes: "notes";
            budget: "budget";
            cover: "cover";
            housingPlan: "housingPlan";
            reference: "reference";
        }>;
        renderKind: z.ZodEnum<{
            keyValueCard: "keyValueCard";
            summaryBox: "summaryBox";
            sectionedTable: "sectionedTable";
            dataTable: "dataTable";
            budgetTable: "budgetTable";
            acronymCard: "acronymCard";
        }>;
        direction: z.ZodEnum<{
            worksheetToApp: "worksheetToApp";
            appToWorksheet: "appToWorksheet";
            bidirectional: "bidirectional";
        }>;
        source: z.ZodObject<{
            sheetId: z.ZodOptional<z.ZodString>;
            range: z.ZodOptional<z.ZodObject<{
                sheetId: z.ZodString;
                anchorText: z.ZodOptional<z.ZodString>;
                headerRow: z.ZodOptional<z.ZodNumber>;
                headerRowCandidates: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
                headerScan: z.ZodOptional<z.ZodObject<{
                    mode: z.ZodEnum<{
                        fixedRowPreferred: "fixedRowPreferred";
                        anchorThenOffset: "anchorThenOffset";
                        scanWindow: "scanWindow";
                    }>;
                    minRow: z.ZodNumber;
                    maxRow: z.ZodNumber;
                    mustContainHeaderIds: z.ZodArray<z.ZodString>;
                    scoreHeaderIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
                }, z.core.$loose>>;
                dataStartRowOffset: z.ZodOptional<z.ZodNumber>;
                dataStartRow: z.ZodOptional<z.ZodNumber>;
                dataEnd: z.ZodOptional<z.ZodObject<{
                    mode: z.ZodEnum<{
                        firstBlankRow: "firstBlankRow";
                        untilNextAnchor: "untilNextAnchor";
                        fixedRow: "fixedRow";
                        worksheetUsedRange: "worksheetUsedRange";
                    }>;
                    fixedRow: z.ZodOptional<z.ZodNumber>;
                    nextAnchorText: z.ZodOptional<z.ZodString>;
                    minConsecutiveBlankRows: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>;
                expectedColumns: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$loose>>;
            keyValues: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
                appField: z.ZodString;
                clientDocField: z.ZodOptional<z.ZodString>;
                dataType: z.ZodEnum<{
                    string: "string";
                    number: "number";
                    date: "date";
                    computed: "computed";
                    url: "url";
                    duration: "duration";
                    currency: "currency";
                    select: "select";
                    longText: "longText";
                    time: "time";
                    signature: "signature";
                }>;
                sheetLabelCell: z.ZodOptional<z.ZodString>;
                sheetValueCell: z.ZodOptional<z.ZodString>;
                labelSearch: z.ZodOptional<z.ZodObject<{
                    sheetId: z.ZodString;
                    labelAliases: z.ZodArray<z.ZodString>;
                    scanRange: z.ZodString;
                    valueOffset: z.ZodOptional<z.ZodObject<{
                        rows: z.ZodNumber;
                        cols: z.ZodNumber;
                    }, z.core.$strip>>;
                    fallbackValueOffsets: z.ZodOptional<z.ZodArray<z.ZodObject<{
                        rows: z.ZodNumber;
                        cols: z.ZodNumber;
                    }, z.core.$strip>>>;
                }, z.core.$loose>>;
                tunnelToClientDoc: z.ZodOptional<z.ZodBoolean>;
                required: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>;
            staticContent: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$loose>;
        fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            expected: z.ZodString;
            aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
            required: z.ZodOptional<z.ZodBoolean>;
            dataType: z.ZodOptional<z.ZodEnum<{
                string: "string";
                number: "number";
                date: "date";
                computed: "computed";
                url: "url";
                duration: "duration";
                currency: "currency";
                select: "select";
                longText: "longText";
                time: "time";
                signature: "signature";
            }>>;
            optionSourceId: z.ZodOptional<z.ZodString>;
            appField: z.ZodOptional<z.ZodString>;
            clientDocField: z.ZodOptional<z.ZodString>;
            display: z.ZodOptional<z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                width: z.ZodOptional<z.ZodEnum<{
                    sm: "sm";
                    md: "md";
                    lg: "lg";
                    xs: "xs";
                    xl: "xl";
                }>>;
                multiline: z.ZodOptional<z.ZodBoolean>;
                hideInCompact: z.ZodOptional<z.ZodBoolean>;
                badge: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>;
            write: z.ZodOptional<z.ZodObject<{
                enabled: z.ZodBoolean;
                lockIfFormula: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>;
        }, z.core.$loose>>>;
        dropdowns: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        display: z.ZodOptional<z.ZodObject<{
            titleField: z.ZodOptional<z.ZodString>;
            subtitleField: z.ZodOptional<z.ZodString>;
            emptyState: z.ZodOptional<z.ZodString>;
            compactFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            sort: z.ZodOptional<z.ZodArray<z.ZodObject<{
                field: z.ZodString;
                direction: z.ZodEnum<{
                    asc: "asc";
                    desc: "desc";
                }>;
            }, z.core.$strip>>>;
            groupBy: z.ZodOptional<z.ZodString>;
            totalFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$loose>>;
        variantOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            source: z.ZodOptional<z.ZodObject<{
                sheetId: z.ZodOptional<z.ZodString>;
                range: z.ZodOptional<z.ZodObject<{
                    sheetId: z.ZodString;
                    anchorText: z.ZodOptional<z.ZodString>;
                    headerRow: z.ZodOptional<z.ZodNumber>;
                    headerRowCandidates: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
                    headerScan: z.ZodOptional<z.ZodObject<{
                        mode: z.ZodEnum<{
                            fixedRowPreferred: "fixedRowPreferred";
                            anchorThenOffset: "anchorThenOffset";
                            scanWindow: "scanWindow";
                        }>;
                        minRow: z.ZodNumber;
                        maxRow: z.ZodNumber;
                        mustContainHeaderIds: z.ZodArray<z.ZodString>;
                        scoreHeaderIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    }, z.core.$loose>>;
                    dataStartRowOffset: z.ZodOptional<z.ZodNumber>;
                    dataStartRow: z.ZodOptional<z.ZodNumber>;
                    dataEnd: z.ZodOptional<z.ZodObject<{
                        mode: z.ZodEnum<{
                            firstBlankRow: "firstBlankRow";
                            untilNextAnchor: "untilNextAnchor";
                            fixedRow: "fixedRow";
                            worksheetUsedRange: "worksheetUsedRange";
                        }>;
                        fixedRow: z.ZodOptional<z.ZodNumber>;
                        nextAnchorText: z.ZodOptional<z.ZodString>;
                        minConsecutiveBlankRows: z.ZodOptional<z.ZodNumber>;
                    }, z.core.$loose>>;
                    expectedColumns: z.ZodOptional<z.ZodArray<z.ZodString>>;
                }, z.core.$loose>>;
                keyValues: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    appField: z.ZodString;
                    clientDocField: z.ZodOptional<z.ZodString>;
                    dataType: z.ZodEnum<{
                        string: "string";
                        number: "number";
                        date: "date";
                        computed: "computed";
                        url: "url";
                        duration: "duration";
                        currency: "currency";
                        select: "select";
                        longText: "longText";
                        time: "time";
                        signature: "signature";
                    }>;
                    sheetLabelCell: z.ZodOptional<z.ZodString>;
                    sheetValueCell: z.ZodOptional<z.ZodString>;
                    labelSearch: z.ZodOptional<z.ZodObject<{
                        sheetId: z.ZodString;
                        labelAliases: z.ZodArray<z.ZodString>;
                        scanRange: z.ZodString;
                        valueOffset: z.ZodOptional<z.ZodObject<{
                            rows: z.ZodNumber;
                            cols: z.ZodNumber;
                        }, z.core.$strip>>;
                        fallbackValueOffsets: z.ZodOptional<z.ZodArray<z.ZodObject<{
                            rows: z.ZodNumber;
                            cols: z.ZodNumber;
                        }, z.core.$strip>>>;
                    }, z.core.$loose>>;
                    tunnelToClientDoc: z.ZodOptional<z.ZodBoolean>;
                    required: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>;
                staticContent: z.ZodOptional<z.ZodUnknown>;
            }, z.core.$loose>>;
            fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                expected: z.ZodString;
                aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
                required: z.ZodOptional<z.ZodBoolean>;
                dataType: z.ZodOptional<z.ZodEnum<{
                    string: "string";
                    number: "number";
                    date: "date";
                    computed: "computed";
                    url: "url";
                    duration: "duration";
                    currency: "currency";
                    select: "select";
                    longText: "longText";
                    time: "time";
                    signature: "signature";
                }>>;
                optionSourceId: z.ZodOptional<z.ZodString>;
                appField: z.ZodOptional<z.ZodString>;
                clientDocField: z.ZodOptional<z.ZodString>;
                display: z.ZodOptional<z.ZodObject<{
                    label: z.ZodOptional<z.ZodString>;
                    width: z.ZodOptional<z.ZodEnum<{
                        sm: "sm";
                        md: "md";
                        lg: "lg";
                        xs: "xs";
                        xl: "xl";
                    }>>;
                    multiline: z.ZodOptional<z.ZodBoolean>;
                    hideInCompact: z.ZodOptional<z.ZodBoolean>;
                    badge: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>;
                write: z.ZodOptional<z.ZodObject<{
                    enabled: z.ZodBoolean;
                    lockIfFormula: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>;
            }, z.core.$loose>>>;
            display: z.ZodOptional<z.ZodObject<{
                titleField: z.ZodOptional<z.ZodString>;
                subtitleField: z.ZodOptional<z.ZodString>;
                emptyState: z.ZodOptional<z.ZodString>;
                compactFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sort: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    direction: z.ZodEnum<{
                        asc: "asc";
                        desc: "desc";
                    }>;
                }, z.core.$strip>>>;
                groupBy: z.ZodOptional<z.ZodString>;
                totalFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$loose>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>;
    parsingDefaults: z.ZodOptional<z.ZodObject<{
        rowDriftTolerance: z.ZodOptional<z.ZodNumber>;
        emptyRowPolicy: z.ZodOptional<z.ZodString>;
        mergedCellPolicy: z.ZodOptional<z.ZodString>;
        coverSheetTunnelPolicy: z.ZodOptional<z.ZodString>;
        datePolicy: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>>;
}, z.core.$loose>;
export type TssWorksheetConfig = z.infer<typeof TssWorksheetConfigSchema>;
export declare const TssOrgConfigOverrideSchema: z.ZodObject<{
    forceVariant: z.ZodOptional<z.ZodEnum<{
        unknown: "unknown";
        payer: "payer";
        nonPayer: "nonPayer";
    }>>;
    disabledEntityIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    sheetAliasExtensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
    fieldAliasExtensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>>;
    fieldDisplayOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        width: z.ZodOptional<z.ZodEnum<{
            sm: "sm";
            md: "md";
            lg: "lg";
            xs: "xs";
            xl: "xl";
        }>>;
        hideInCompact: z.ZodOptional<z.ZodBoolean>;
        badge: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>>;
    entityEmptyStateOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    entityLabelOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$loose>;
export type TssOrgConfigOverride = z.infer<typeof TssOrgConfigOverrideSchema>;
export declare const TssExtractionWarningSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    entityId: z.ZodOptional<z.ZodString>;
    sheetId: z.ZodOptional<z.ZodString>;
    fieldId: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodEnum<{
        error: "error";
        warning: "warning";
        info: "info";
    }>>;
}, z.core.$loose>;
export type TssExtractionWarning = z.infer<typeof TssExtractionWarningSchema>;
export declare const TssExtractedEntityStatusSchema: z.ZodEnum<{
    error: "error";
    extracted: "extracted";
    empty: "empty";
    unsupported: "unsupported";
    missing_sheet: "missing_sheet";
    missing_headers: "missing_headers";
}>;
export type TssExtractedEntityStatus = z.infer<typeof TssExtractedEntityStatusSchema>;
export declare const TssExtractedCellSchema: z.ZodObject<{
    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
    displayValue: z.ZodOptional<z.ZodString>;
    kind: z.ZodOptional<z.ZodEnum<{
        string: "string";
        number: "number";
        boolean: "boolean";
        date: "date";
        empty: "empty";
    }>>;
}, z.core.$loose>;
export type TssExtractedCell = z.infer<typeof TssExtractedCellSchema>;
export declare const TssExtractedRowSchema: z.ZodObject<{
    rowKey: z.ZodString;
    values: z.ZodRecord<z.ZodString, z.ZodObject<{
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
        displayValue: z.ZodOptional<z.ZodString>;
        kind: z.ZodOptional<z.ZodEnum<{
            string: "string";
            number: "number";
            boolean: "boolean";
            date: "date";
            empty: "empty";
        }>>;
    }, z.core.$loose>>;
    warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        entityId: z.ZodOptional<z.ZodString>;
        sheetId: z.ZodOptional<z.ZodString>;
        fieldId: z.ZodOptional<z.ZodString>;
        severity: z.ZodOptional<z.ZodEnum<{
            error: "error";
            warning: "warning";
            info: "info";
        }>>;
    }, z.core.$loose>>>;
}, z.core.$loose>;
export type TssExtractedRow = z.infer<typeof TssExtractedRowSchema>;
export declare const TssNoteSectionBreakSchema: z.ZodObject<{
    rowKey: z.ZodString;
    text: z.ZodString;
}, z.core.$loose>;
export type TssNoteSectionBreak = z.infer<typeof TssNoteSectionBreakSchema>;
export declare const TssExtractedEntitySchema: z.ZodObject<{
    entityId: z.ZodString;
    renderKind: z.ZodEnum<{
        keyValueCard: "keyValueCard";
        summaryBox: "summaryBox";
        sectionedTable: "sectionedTable";
        dataTable: "dataTable";
        budgetTable: "budgetTable";
        acronymCard: "acronymCard";
    }>;
    label: z.ZodString;
    section: z.ZodEnum<{
        notes: "notes";
        budget: "budget";
        cover: "cover";
        housingPlan: "housingPlan";
        reference: "reference";
    }>;
    status: z.ZodEnum<{
        error: "error";
        extracted: "extracted";
        empty: "empty";
        unsupported: "unsupported";
        missing_sheet: "missing_sheet";
        missing_headers: "missing_headers";
    }>;
    values: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
        displayValue: z.ZodOptional<z.ZodString>;
        kind: z.ZodOptional<z.ZodEnum<{
            string: "string";
            number: "number";
            boolean: "boolean";
            date: "date";
            empty: "empty";
        }>>;
    }, z.core.$loose>>>;
    rows: z.ZodOptional<z.ZodArray<z.ZodObject<{
        rowKey: z.ZodString;
        values: z.ZodRecord<z.ZodString, z.ZodObject<{
            value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
            displayValue: z.ZodOptional<z.ZodString>;
            kind: z.ZodOptional<z.ZodEnum<{
                string: "string";
                number: "number";
                boolean: "boolean";
                date: "date";
                empty: "empty";
            }>>;
        }, z.core.$loose>>;
        warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
            entityId: z.ZodOptional<z.ZodString>;
            sheetId: z.ZodOptional<z.ZodString>;
            fieldId: z.ZodOptional<z.ZodString>;
            severity: z.ZodOptional<z.ZodEnum<{
                error: "error";
                warning: "warning";
                info: "info";
            }>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    sectionBreaks: z.ZodOptional<z.ZodArray<z.ZodObject<{
        rowKey: z.ZodString;
        text: z.ZodString;
    }, z.core.$loose>>>;
    budget: z.ZodOptional<z.ZodUnknown>;
    warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        entityId: z.ZodOptional<z.ZodString>;
        sheetId: z.ZodOptional<z.ZodString>;
        fieldId: z.ZodOptional<z.ZodString>;
        severity: z.ZodOptional<z.ZodEnum<{
            error: "error";
            warning: "warning";
            info: "info";
        }>>;
    }, z.core.$loose>>>;
}, z.core.$loose>;
export type TssExtractedEntity = z.infer<typeof TssExtractedEntitySchema>;
export declare const TssWorkbookExtractSchema: z.ZodObject<{
    customerId: z.ZodString;
    spreadsheetId: z.ZodString;
    spreadsheetName: z.ZodOptional<z.ZodString>;
    variant: z.ZodEnum<{
        unknown: "unknown";
        payer: "payer";
        nonPayer: "nonPayer";
    }>;
    entities: z.ZodArray<z.ZodObject<{
        entityId: z.ZodString;
        renderKind: z.ZodEnum<{
            keyValueCard: "keyValueCard";
            summaryBox: "summaryBox";
            sectionedTable: "sectionedTable";
            dataTable: "dataTable";
            budgetTable: "budgetTable";
            acronymCard: "acronymCard";
        }>;
        label: z.ZodString;
        section: z.ZodEnum<{
            notes: "notes";
            budget: "budget";
            cover: "cover";
            housingPlan: "housingPlan";
            reference: "reference";
        }>;
        status: z.ZodEnum<{
            error: "error";
            extracted: "extracted";
            empty: "empty";
            unsupported: "unsupported";
            missing_sheet: "missing_sheet";
            missing_headers: "missing_headers";
        }>;
        values: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
            displayValue: z.ZodOptional<z.ZodString>;
            kind: z.ZodOptional<z.ZodEnum<{
                string: "string";
                number: "number";
                boolean: "boolean";
                date: "date";
                empty: "empty";
            }>>;
        }, z.core.$loose>>>;
        rows: z.ZodOptional<z.ZodArray<z.ZodObject<{
            rowKey: z.ZodString;
            values: z.ZodRecord<z.ZodString, z.ZodObject<{
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
                displayValue: z.ZodOptional<z.ZodString>;
                kind: z.ZodOptional<z.ZodEnum<{
                    string: "string";
                    number: "number";
                    boolean: "boolean";
                    date: "date";
                    empty: "empty";
                }>>;
            }, z.core.$loose>>;
            warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
                code: z.ZodString;
                message: z.ZodString;
                entityId: z.ZodOptional<z.ZodString>;
                sheetId: z.ZodOptional<z.ZodString>;
                fieldId: z.ZodOptional<z.ZodString>;
                severity: z.ZodOptional<z.ZodEnum<{
                    error: "error";
                    warning: "warning";
                    info: "info";
                }>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
        sectionBreaks: z.ZodOptional<z.ZodArray<z.ZodObject<{
            rowKey: z.ZodString;
            text: z.ZodString;
        }, z.core.$loose>>>;
        budget: z.ZodOptional<z.ZodUnknown>;
        warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
            entityId: z.ZodOptional<z.ZodString>;
            sheetId: z.ZodOptional<z.ZodString>;
            fieldId: z.ZodOptional<z.ZodString>;
            severity: z.ZodOptional<z.ZodEnum<{
                error: "error";
                warning: "warning";
                info: "info";
            }>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>;
    warnings: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        entityId: z.ZodOptional<z.ZodString>;
        sheetId: z.ZodOptional<z.ZodString>;
        fieldId: z.ZodOptional<z.ZodString>;
        severity: z.ZodOptional<z.ZodEnum<{
            error: "error";
            warning: "warning";
            info: "info";
        }>>;
    }, z.core.$loose>>;
    extractedAt: z.ZodString;
    spreadsheetModifiedTime: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    configVersion: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type TssWorkbookExtract = z.infer<typeof TssWorkbookExtractSchema>;
export declare function smartHeaderId(value: string): string;
export declare const TSS_SHEETS: {
    readonly lists: {
        readonly id: "lists";
        readonly expectedNames: readonly ["_Lists"];
        readonly aliases: readonly ["Lists", "Dropdown Lists", "_lists"];
        readonly hidden: true;
        readonly resolutionMode: "exactOrAlias";
        readonly headerIdStrategy: {
            readonly normalize: "smartHeaderIdV1";
            readonly collisionPolicy: "preferExactThenAliasThenLeftmost";
        };
    };
    readonly cover: {
        readonly id: "cover";
        readonly expectedNames: readonly ["1. Cover Sheet"];
        readonly aliases: readonly ["Cover Sheet", "Client Cover Sheet", "1 Cover Sheet"];
        readonly resolutionMode: "exactOrAlias";
    };
    readonly housingPlan: {
        readonly id: "housingPlan";
        readonly expectedNames: readonly ["4. Housing Plan"];
        readonly aliases: readonly ["Housing Plan", "4 Housing Plan", "Plan"];
        readonly resolutionMode: "exactOrAlias";
        readonly headerIdStrategy: {
            readonly normalize: "smartHeaderIdV1";
            readonly collisionPolicy: "preferExactThenAliasThenLeftmost";
        };
    };
    readonly progressNotes: {
        readonly id: "progressNotes";
        readonly expectedNames: readonly ["6. Progress Notes", "Progress Notes"];
        readonly aliases: readonly ["Progress Notes", "Notes", "Service Notes", "6 Progress Notes"];
        readonly resolutionMode: "exactOrAlias";
        readonly headerIdStrategy: {
            readonly normalize: "smartHeaderIdV1";
            readonly collisionPolicy: "preferExactThenAliasThenLeftmost";
        };
    };
    readonly budget: {
        readonly id: "budget";
        readonly expectedNames: readonly ["Budget"];
        readonly aliases: readonly ["Client Budget", "Monthly Budget"];
        readonly resolutionMode: "exactOrAlias";
        readonly headerIdStrategy: {
            readonly normalize: "smartHeaderIdV1";
            readonly collisionPolicy: "preferExactThenAliasThenLeftmost";
        };
    };
};
export declare const TSS_WORKBOOK_VARIANT_RULES: readonly [{
    readonly variant: TssWorkbookVariant;
    readonly ifSheetExists: "6. Progress Notes";
    readonly notes: "Full worksheet. Progress Notes header usually row 3; Housing Plan goal table usually starts row 22.";
}, {
    readonly variant: TssWorkbookVariant;
    readonly ifSheetExists: "Progress Notes";
    readonly notes: "Simplified worksheet. Progress Notes header usually row 1; Housing Plan goal table usually starts row 19.";
}];
export declare const TSS_HEADER_ALIASES: {
    readonly clientName: readonly ["Client Name", "Member Name", "Customer Name", "Participant Name"];
    readonly dob: readonly ["DOB", "Date of Birth"];
    readonly hmisCwId: readonly ["HMIS/CW ID", "HMIS ID", "CWID", "CaseWorthy ID", "Caseworthy ID", "HMIS/CWID"];
    readonly medicaidId: readonly ["Medicaid ID", "MA ID", "Montana Medicaid ID"];
    readonly primaryCaseManager: readonly ["Primary CM", "Case Manager", "Primary Case Manager", "Staff Name"];
    readonly phone: readonly ["Phone", "Phone Number", "Client Phone"];
    readonly email: readonly ["Email", "Email Address", "Client Email"];
    readonly providerSelection: readonly ["Provider Selection", "Provider Choice"];
    readonly otherProviderName: readonly ["If Other, Provider Name", "Other Provider Name", "Provider Name"];
    readonly quickLinks: readonly ["Quick Links (paste URLs to tabs/docs)", "Quick Links", "Links"];
    readonly currentPaNumber: readonly ["Current PA Number", "PA Number", "Prior Authorization Number"];
    readonly paEffective: readonly ["PA Effective", "PA Effective Date", "Authorization Start"];
    readonly paExpiration: readonly ["PA Expiration", "PA Expiration Date", "Authorization End"];
    readonly next120DayReviewDue: readonly ["Next 120-day Review Due", "Review Due (≤120 days)", "Next Review Due"];
    readonly nextAnnualReAuthDue: readonly ["Next Annual Re-Auth Due", "Next Annual Reauth Due", "Annual Re-Authorization Due"];
    readonly planDate: readonly ["Plan Date", "Housing Plan Date"];
    readonly reviewDue: readonly ["Review Due (≤120 days)", "Review Due", "Next Review Due"];
    readonly clientStrengths: readonly ["Client Strengths", "Strengths", "Customer Strengths"];
    readonly cmSummary: readonly ["CM Summary", "Case Manager Summary", "Staff Summary"];
    readonly barrier: readonly ["Barrier", "Housing Barrier", "Housing Barriers"];
    readonly mitigationSupports: readonly ["Mitigation/Supports", "Mitigation Supports", "Supports", "Plan to Address Barrier"];
    readonly serviceTier: readonly ["Service Tier (U1/U2/U3)", "Service Tier: cheatsheets here and here ", "Service Tier", "Tier"];
    readonly goalSmart: readonly ["Goal (SMART)", "SMART Goal", "Goal"];
    readonly objective: readonly ["Objective", "Objectives"];
    readonly interventionTask: readonly ["Intervention/Task", "Intervention", "Task"];
    readonly goalCompletionCriteria: readonly ["Goal Completion Criteria", "Completion Criteria", "Success Criteria"];
    readonly responsible: readonly ["Responsible", "Responsible Party", "Owner"];
    readonly targetDate: readonly ["Target Date", "Due Date"];
    readonly status: readonly ["Status", "Goal Status"];
    readonly notes: readonly ["Notes", "Goal Notes"];
    readonly progressDate: readonly ["Date", "Service Date", "Note Date"];
    readonly startTime: readonly ["Start Time"];
    readonly endTime: readonly ["End Time"];
    readonly totalTime: readonly ["Total Time", "Duration"];
    readonly summary: readonly ["Summary (what & why)", "Summary", "Note Summary"];
    readonly clientResponseProgress: readonly ["Client Response/Progress", "Client Response", "Progress"];
    readonly linkedPlanGoal: readonly ["Linked Plan Goal", "Linked Goal", "Goal #"];
    readonly location: readonly ["Location of appointment", "Location", "Appointment Location"];
    readonly staffName: readonly ["Staff name ", "Staff Name", "Staff"];
    readonly staffInitial: readonly ["Staff initial", "Staff Initial", "Staff Initials"];
    readonly staffSignature: readonly ["Staff signature", "Staff Signature", "Signature"];
    readonly completionDate: readonly ["Date of completion", "Completion Date"];
};
export declare const TSS_DROPDOWN_LISTS: {
    yesNo: {
        id: string;
        sheetId: string;
        namedRange: string;
        expectedHeader: string;
        expectedColumn: string;
        values: string[];
    };
    providerChoice: {
        id: string;
        sheetId: string;
        namedRange: string;
        expectedHeader: string;
        expectedColumn: string;
        values: string[];
    };
    supportItem: {
        id: string;
        sheetId: string;
        namedRange: string;
        expectedHeader: string;
        expectedColumn: string;
        values: string[];
    };
    serviceTier: {
        id: string;
        sheetId: string;
        namedRange: string;
        expectedHeader: string;
        expectedColumn: string;
        values: string[];
    };
    method: {
        id: string;
        sheetId: string;
        namedRange: string;
        expectedHeader: string;
        expectedColumn: string;
        values: string[];
    };
    placeOfService: {
        id: string;
        sheetId: string;
        namedRange: string;
        expectedHeader: string;
        expectedColumn: string;
        values: string[];
    };
    statusList: {
        id: string;
        sheetId: string;
        namedRange: string;
        expectedHeader: string;
        expectedColumn: string;
        values: string[];
    };
    hardshipDetermination: {
        id: string;
        sheetId: string;
        namedRange: string;
        expectedHeader: string;
        expectedColumn: string;
        values: string[];
    };
    finalStatus: {
        id: string;
        sheetId: string;
        namedRange: string;
        expectedHeader: string;
        expectedColumn: string;
        values: string[];
    };
    denialReason: {
        id: string;
        sheetId: string;
        namedRange: string;
        expectedHeader: string;
        expectedColumn: string;
        values: string[];
    };
    actionTaken: {
        id: string;
        sheetId: string;
        namedRange: string;
        expectedHeader: string;
        expectedColumn: string;
        values: string[];
    };
    contactMethod: {
        id: string;
        sheetId: string;
        namedRange: string;
        expectedHeader: string;
        expectedColumn: string;
        values: string[];
    };
    clientResponse: {
        id: string;
        sheetId: string;
        namedRange: string;
        expectedHeader: string;
        expectedColumn: string;
        values: string[];
    };
    responsibleParty: {
        id: string;
        inlineValues: true;
        values: string[];
    };
    appointmentLocation: {
        id: string;
        inlineValues: true;
        values: string[];
    };
};
export declare const TSS_COVER_ENTITY: TssDisplayEntityConfig;
export declare const TSS_CUSTOMER_STRENGTHS_ENTITY: TssDisplayEntityConfig;
export declare const TSS_HOUSING_BARRIERS_ENTITY: TssDisplayEntityConfig;
export declare const TSS_GOALS_ENTITY: TssDisplayEntityConfig;
export declare const TSS_SMART_GOALS_ACRONYM_ENTITY: TssDisplayEntityConfig;
export declare const TSS_PROGRESS_NOTES_ENTITY: TssDisplayEntityConfig;
export declare const TSS_BUDGET_ENTITY: TssDisplayEntityConfig;
export declare const TSS_DISPLAY_ENTITIES: {
    readonly coverSheet: {
        [x: string]: unknown;
        id: string;
        label: string;
        section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
        renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
        direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
        source: {
            [x: string]: unknown;
            sheetId?: string | undefined;
            range?: {
                [x: string]: unknown;
                sheetId: string;
                anchorText?: string | undefined;
                headerRow?: number | undefined;
                headerRowCandidates?: number[] | undefined;
                headerScan?: {
                    [x: string]: unknown;
                    mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                    minRow: number;
                    maxRow: number;
                    mustContainHeaderIds: string[];
                    scoreHeaderIds?: string[] | undefined;
                } | undefined;
                dataStartRowOffset?: number | undefined;
                dataStartRow?: number | undefined;
                dataEnd?: {
                    [x: string]: unknown;
                    mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                    fixedRow?: number | undefined;
                    nextAnchorText?: string | undefined;
                    minConsecutiveBlankRows?: number | undefined;
                } | undefined;
                expectedColumns?: string[] | undefined;
            } | undefined;
            keyValues?: {
                [x: string]: unknown;
                id: string;
                label: string;
                appField: string;
                dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                aliases?: string[] | undefined;
                clientDocField?: string | undefined;
                sheetLabelCell?: string | undefined;
                sheetValueCell?: string | undefined;
                labelSearch?: {
                    [x: string]: unknown;
                    sheetId: string;
                    labelAliases: string[];
                    scanRange: string;
                    valueOffset?: {
                        rows: number;
                        cols: number;
                    } | undefined;
                    fallbackValueOffsets?: {
                        rows: number;
                        cols: number;
                    }[] | undefined;
                } | undefined;
                tunnelToClientDoc?: boolean | undefined;
                required?: boolean | undefined;
            }[] | undefined;
            staticContent?: unknown;
        };
        fields?: {
            [x: string]: unknown;
            id: string;
            expected: string;
            aliases?: string[] | undefined;
            required?: boolean | undefined;
            dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
            optionSourceId?: string | undefined;
            appField?: string | undefined;
            clientDocField?: string | undefined;
            display?: {
                [x: string]: unknown;
                label?: string | undefined;
                width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                multiline?: boolean | undefined;
                hideInCompact?: boolean | undefined;
                badge?: boolean | undefined;
            } | undefined;
            write?: {
                [x: string]: unknown;
                enabled: boolean;
                lockIfFormula?: boolean | undefined;
            } | undefined;
        }[] | undefined;
        dropdowns?: Record<string, string> | undefined;
        display?: {
            [x: string]: unknown;
            titleField?: string | undefined;
            subtitleField?: string | undefined;
            emptyState?: string | undefined;
            compactFields?: string[] | undefined;
            sort?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            groupBy?: string | undefined;
            totalFields?: string[] | undefined;
        } | undefined;
        variantOverrides?: Record<string, {
            [x: string]: unknown;
            source?: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            } | undefined;
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
        }> | undefined;
    };
    readonly customerStrengths: {
        [x: string]: unknown;
        id: string;
        label: string;
        section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
        renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
        direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
        source: {
            [x: string]: unknown;
            sheetId?: string | undefined;
            range?: {
                [x: string]: unknown;
                sheetId: string;
                anchorText?: string | undefined;
                headerRow?: number | undefined;
                headerRowCandidates?: number[] | undefined;
                headerScan?: {
                    [x: string]: unknown;
                    mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                    minRow: number;
                    maxRow: number;
                    mustContainHeaderIds: string[];
                    scoreHeaderIds?: string[] | undefined;
                } | undefined;
                dataStartRowOffset?: number | undefined;
                dataStartRow?: number | undefined;
                dataEnd?: {
                    [x: string]: unknown;
                    mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                    fixedRow?: number | undefined;
                    nextAnchorText?: string | undefined;
                    minConsecutiveBlankRows?: number | undefined;
                } | undefined;
                expectedColumns?: string[] | undefined;
            } | undefined;
            keyValues?: {
                [x: string]: unknown;
                id: string;
                label: string;
                appField: string;
                dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                aliases?: string[] | undefined;
                clientDocField?: string | undefined;
                sheetLabelCell?: string | undefined;
                sheetValueCell?: string | undefined;
                labelSearch?: {
                    [x: string]: unknown;
                    sheetId: string;
                    labelAliases: string[];
                    scanRange: string;
                    valueOffset?: {
                        rows: number;
                        cols: number;
                    } | undefined;
                    fallbackValueOffsets?: {
                        rows: number;
                        cols: number;
                    }[] | undefined;
                } | undefined;
                tunnelToClientDoc?: boolean | undefined;
                required?: boolean | undefined;
            }[] | undefined;
            staticContent?: unknown;
        };
        fields?: {
            [x: string]: unknown;
            id: string;
            expected: string;
            aliases?: string[] | undefined;
            required?: boolean | undefined;
            dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
            optionSourceId?: string | undefined;
            appField?: string | undefined;
            clientDocField?: string | undefined;
            display?: {
                [x: string]: unknown;
                label?: string | undefined;
                width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                multiline?: boolean | undefined;
                hideInCompact?: boolean | undefined;
                badge?: boolean | undefined;
            } | undefined;
            write?: {
                [x: string]: unknown;
                enabled: boolean;
                lockIfFormula?: boolean | undefined;
            } | undefined;
        }[] | undefined;
        dropdowns?: Record<string, string> | undefined;
        display?: {
            [x: string]: unknown;
            titleField?: string | undefined;
            subtitleField?: string | undefined;
            emptyState?: string | undefined;
            compactFields?: string[] | undefined;
            sort?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            groupBy?: string | undefined;
            totalFields?: string[] | undefined;
        } | undefined;
        variantOverrides?: Record<string, {
            [x: string]: unknown;
            source?: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            } | undefined;
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
        }> | undefined;
    };
    readonly housingBarriers: {
        [x: string]: unknown;
        id: string;
        label: string;
        section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
        renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
        direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
        source: {
            [x: string]: unknown;
            sheetId?: string | undefined;
            range?: {
                [x: string]: unknown;
                sheetId: string;
                anchorText?: string | undefined;
                headerRow?: number | undefined;
                headerRowCandidates?: number[] | undefined;
                headerScan?: {
                    [x: string]: unknown;
                    mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                    minRow: number;
                    maxRow: number;
                    mustContainHeaderIds: string[];
                    scoreHeaderIds?: string[] | undefined;
                } | undefined;
                dataStartRowOffset?: number | undefined;
                dataStartRow?: number | undefined;
                dataEnd?: {
                    [x: string]: unknown;
                    mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                    fixedRow?: number | undefined;
                    nextAnchorText?: string | undefined;
                    minConsecutiveBlankRows?: number | undefined;
                } | undefined;
                expectedColumns?: string[] | undefined;
            } | undefined;
            keyValues?: {
                [x: string]: unknown;
                id: string;
                label: string;
                appField: string;
                dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                aliases?: string[] | undefined;
                clientDocField?: string | undefined;
                sheetLabelCell?: string | undefined;
                sheetValueCell?: string | undefined;
                labelSearch?: {
                    [x: string]: unknown;
                    sheetId: string;
                    labelAliases: string[];
                    scanRange: string;
                    valueOffset?: {
                        rows: number;
                        cols: number;
                    } | undefined;
                    fallbackValueOffsets?: {
                        rows: number;
                        cols: number;
                    }[] | undefined;
                } | undefined;
                tunnelToClientDoc?: boolean | undefined;
                required?: boolean | undefined;
            }[] | undefined;
            staticContent?: unknown;
        };
        fields?: {
            [x: string]: unknown;
            id: string;
            expected: string;
            aliases?: string[] | undefined;
            required?: boolean | undefined;
            dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
            optionSourceId?: string | undefined;
            appField?: string | undefined;
            clientDocField?: string | undefined;
            display?: {
                [x: string]: unknown;
                label?: string | undefined;
                width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                multiline?: boolean | undefined;
                hideInCompact?: boolean | undefined;
                badge?: boolean | undefined;
            } | undefined;
            write?: {
                [x: string]: unknown;
                enabled: boolean;
                lockIfFormula?: boolean | undefined;
            } | undefined;
        }[] | undefined;
        dropdowns?: Record<string, string> | undefined;
        display?: {
            [x: string]: unknown;
            titleField?: string | undefined;
            subtitleField?: string | undefined;
            emptyState?: string | undefined;
            compactFields?: string[] | undefined;
            sort?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            groupBy?: string | undefined;
            totalFields?: string[] | undefined;
        } | undefined;
        variantOverrides?: Record<string, {
            [x: string]: unknown;
            source?: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            } | undefined;
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
        }> | undefined;
    };
    readonly goals: {
        [x: string]: unknown;
        id: string;
        label: string;
        section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
        renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
        direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
        source: {
            [x: string]: unknown;
            sheetId?: string | undefined;
            range?: {
                [x: string]: unknown;
                sheetId: string;
                anchorText?: string | undefined;
                headerRow?: number | undefined;
                headerRowCandidates?: number[] | undefined;
                headerScan?: {
                    [x: string]: unknown;
                    mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                    minRow: number;
                    maxRow: number;
                    mustContainHeaderIds: string[];
                    scoreHeaderIds?: string[] | undefined;
                } | undefined;
                dataStartRowOffset?: number | undefined;
                dataStartRow?: number | undefined;
                dataEnd?: {
                    [x: string]: unknown;
                    mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                    fixedRow?: number | undefined;
                    nextAnchorText?: string | undefined;
                    minConsecutiveBlankRows?: number | undefined;
                } | undefined;
                expectedColumns?: string[] | undefined;
            } | undefined;
            keyValues?: {
                [x: string]: unknown;
                id: string;
                label: string;
                appField: string;
                dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                aliases?: string[] | undefined;
                clientDocField?: string | undefined;
                sheetLabelCell?: string | undefined;
                sheetValueCell?: string | undefined;
                labelSearch?: {
                    [x: string]: unknown;
                    sheetId: string;
                    labelAliases: string[];
                    scanRange: string;
                    valueOffset?: {
                        rows: number;
                        cols: number;
                    } | undefined;
                    fallbackValueOffsets?: {
                        rows: number;
                        cols: number;
                    }[] | undefined;
                } | undefined;
                tunnelToClientDoc?: boolean | undefined;
                required?: boolean | undefined;
            }[] | undefined;
            staticContent?: unknown;
        };
        fields?: {
            [x: string]: unknown;
            id: string;
            expected: string;
            aliases?: string[] | undefined;
            required?: boolean | undefined;
            dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
            optionSourceId?: string | undefined;
            appField?: string | undefined;
            clientDocField?: string | undefined;
            display?: {
                [x: string]: unknown;
                label?: string | undefined;
                width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                multiline?: boolean | undefined;
                hideInCompact?: boolean | undefined;
                badge?: boolean | undefined;
            } | undefined;
            write?: {
                [x: string]: unknown;
                enabled: boolean;
                lockIfFormula?: boolean | undefined;
            } | undefined;
        }[] | undefined;
        dropdowns?: Record<string, string> | undefined;
        display?: {
            [x: string]: unknown;
            titleField?: string | undefined;
            subtitleField?: string | undefined;
            emptyState?: string | undefined;
            compactFields?: string[] | undefined;
            sort?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            groupBy?: string | undefined;
            totalFields?: string[] | undefined;
        } | undefined;
        variantOverrides?: Record<string, {
            [x: string]: unknown;
            source?: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            } | undefined;
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
        }> | undefined;
    };
    readonly smartGoalsAcronym: {
        [x: string]: unknown;
        id: string;
        label: string;
        section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
        renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
        direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
        source: {
            [x: string]: unknown;
            sheetId?: string | undefined;
            range?: {
                [x: string]: unknown;
                sheetId: string;
                anchorText?: string | undefined;
                headerRow?: number | undefined;
                headerRowCandidates?: number[] | undefined;
                headerScan?: {
                    [x: string]: unknown;
                    mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                    minRow: number;
                    maxRow: number;
                    mustContainHeaderIds: string[];
                    scoreHeaderIds?: string[] | undefined;
                } | undefined;
                dataStartRowOffset?: number | undefined;
                dataStartRow?: number | undefined;
                dataEnd?: {
                    [x: string]: unknown;
                    mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                    fixedRow?: number | undefined;
                    nextAnchorText?: string | undefined;
                    minConsecutiveBlankRows?: number | undefined;
                } | undefined;
                expectedColumns?: string[] | undefined;
            } | undefined;
            keyValues?: {
                [x: string]: unknown;
                id: string;
                label: string;
                appField: string;
                dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                aliases?: string[] | undefined;
                clientDocField?: string | undefined;
                sheetLabelCell?: string | undefined;
                sheetValueCell?: string | undefined;
                labelSearch?: {
                    [x: string]: unknown;
                    sheetId: string;
                    labelAliases: string[];
                    scanRange: string;
                    valueOffset?: {
                        rows: number;
                        cols: number;
                    } | undefined;
                    fallbackValueOffsets?: {
                        rows: number;
                        cols: number;
                    }[] | undefined;
                } | undefined;
                tunnelToClientDoc?: boolean | undefined;
                required?: boolean | undefined;
            }[] | undefined;
            staticContent?: unknown;
        };
        fields?: {
            [x: string]: unknown;
            id: string;
            expected: string;
            aliases?: string[] | undefined;
            required?: boolean | undefined;
            dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
            optionSourceId?: string | undefined;
            appField?: string | undefined;
            clientDocField?: string | undefined;
            display?: {
                [x: string]: unknown;
                label?: string | undefined;
                width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                multiline?: boolean | undefined;
                hideInCompact?: boolean | undefined;
                badge?: boolean | undefined;
            } | undefined;
            write?: {
                [x: string]: unknown;
                enabled: boolean;
                lockIfFormula?: boolean | undefined;
            } | undefined;
        }[] | undefined;
        dropdowns?: Record<string, string> | undefined;
        display?: {
            [x: string]: unknown;
            titleField?: string | undefined;
            subtitleField?: string | undefined;
            emptyState?: string | undefined;
            compactFields?: string[] | undefined;
            sort?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            groupBy?: string | undefined;
            totalFields?: string[] | undefined;
        } | undefined;
        variantOverrides?: Record<string, {
            [x: string]: unknown;
            source?: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            } | undefined;
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
        }> | undefined;
    };
    readonly progressNotes: {
        [x: string]: unknown;
        id: string;
        label: string;
        section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
        renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
        direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
        source: {
            [x: string]: unknown;
            sheetId?: string | undefined;
            range?: {
                [x: string]: unknown;
                sheetId: string;
                anchorText?: string | undefined;
                headerRow?: number | undefined;
                headerRowCandidates?: number[] | undefined;
                headerScan?: {
                    [x: string]: unknown;
                    mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                    minRow: number;
                    maxRow: number;
                    mustContainHeaderIds: string[];
                    scoreHeaderIds?: string[] | undefined;
                } | undefined;
                dataStartRowOffset?: number | undefined;
                dataStartRow?: number | undefined;
                dataEnd?: {
                    [x: string]: unknown;
                    mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                    fixedRow?: number | undefined;
                    nextAnchorText?: string | undefined;
                    minConsecutiveBlankRows?: number | undefined;
                } | undefined;
                expectedColumns?: string[] | undefined;
            } | undefined;
            keyValues?: {
                [x: string]: unknown;
                id: string;
                label: string;
                appField: string;
                dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                aliases?: string[] | undefined;
                clientDocField?: string | undefined;
                sheetLabelCell?: string | undefined;
                sheetValueCell?: string | undefined;
                labelSearch?: {
                    [x: string]: unknown;
                    sheetId: string;
                    labelAliases: string[];
                    scanRange: string;
                    valueOffset?: {
                        rows: number;
                        cols: number;
                    } | undefined;
                    fallbackValueOffsets?: {
                        rows: number;
                        cols: number;
                    }[] | undefined;
                } | undefined;
                tunnelToClientDoc?: boolean | undefined;
                required?: boolean | undefined;
            }[] | undefined;
            staticContent?: unknown;
        };
        fields?: {
            [x: string]: unknown;
            id: string;
            expected: string;
            aliases?: string[] | undefined;
            required?: boolean | undefined;
            dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
            optionSourceId?: string | undefined;
            appField?: string | undefined;
            clientDocField?: string | undefined;
            display?: {
                [x: string]: unknown;
                label?: string | undefined;
                width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                multiline?: boolean | undefined;
                hideInCompact?: boolean | undefined;
                badge?: boolean | undefined;
            } | undefined;
            write?: {
                [x: string]: unknown;
                enabled: boolean;
                lockIfFormula?: boolean | undefined;
            } | undefined;
        }[] | undefined;
        dropdowns?: Record<string, string> | undefined;
        display?: {
            [x: string]: unknown;
            titleField?: string | undefined;
            subtitleField?: string | undefined;
            emptyState?: string | undefined;
            compactFields?: string[] | undefined;
            sort?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            groupBy?: string | undefined;
            totalFields?: string[] | undefined;
        } | undefined;
        variantOverrides?: Record<string, {
            [x: string]: unknown;
            source?: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            } | undefined;
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
        }> | undefined;
    };
    readonly budget: {
        [x: string]: unknown;
        id: string;
        label: string;
        section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
        renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
        direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
        source: {
            [x: string]: unknown;
            sheetId?: string | undefined;
            range?: {
                [x: string]: unknown;
                sheetId: string;
                anchorText?: string | undefined;
                headerRow?: number | undefined;
                headerRowCandidates?: number[] | undefined;
                headerScan?: {
                    [x: string]: unknown;
                    mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                    minRow: number;
                    maxRow: number;
                    mustContainHeaderIds: string[];
                    scoreHeaderIds?: string[] | undefined;
                } | undefined;
                dataStartRowOffset?: number | undefined;
                dataStartRow?: number | undefined;
                dataEnd?: {
                    [x: string]: unknown;
                    mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                    fixedRow?: number | undefined;
                    nextAnchorText?: string | undefined;
                    minConsecutiveBlankRows?: number | undefined;
                } | undefined;
                expectedColumns?: string[] | undefined;
            } | undefined;
            keyValues?: {
                [x: string]: unknown;
                id: string;
                label: string;
                appField: string;
                dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                aliases?: string[] | undefined;
                clientDocField?: string | undefined;
                sheetLabelCell?: string | undefined;
                sheetValueCell?: string | undefined;
                labelSearch?: {
                    [x: string]: unknown;
                    sheetId: string;
                    labelAliases: string[];
                    scanRange: string;
                    valueOffset?: {
                        rows: number;
                        cols: number;
                    } | undefined;
                    fallbackValueOffsets?: {
                        rows: number;
                        cols: number;
                    }[] | undefined;
                } | undefined;
                tunnelToClientDoc?: boolean | undefined;
                required?: boolean | undefined;
            }[] | undefined;
            staticContent?: unknown;
        };
        fields?: {
            [x: string]: unknown;
            id: string;
            expected: string;
            aliases?: string[] | undefined;
            required?: boolean | undefined;
            dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
            optionSourceId?: string | undefined;
            appField?: string | undefined;
            clientDocField?: string | undefined;
            display?: {
                [x: string]: unknown;
                label?: string | undefined;
                width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                multiline?: boolean | undefined;
                hideInCompact?: boolean | undefined;
                badge?: boolean | undefined;
            } | undefined;
            write?: {
                [x: string]: unknown;
                enabled: boolean;
                lockIfFormula?: boolean | undefined;
            } | undefined;
        }[] | undefined;
        dropdowns?: Record<string, string> | undefined;
        display?: {
            [x: string]: unknown;
            titleField?: string | undefined;
            subtitleField?: string | undefined;
            emptyState?: string | undefined;
            compactFields?: string[] | undefined;
            sort?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            groupBy?: string | undefined;
            totalFields?: string[] | undefined;
        } | undefined;
        variantOverrides?: Record<string, {
            [x: string]: unknown;
            source?: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            } | undefined;
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
        }> | undefined;
    };
};
export type TTssDisplayEntities = typeof TSS_DISPLAY_ENTITIES;
export declare const TSS_WORKSHEET_CONFIG: {
    readonly version: "2026-06-02.tss-display-config.v1";
    readonly workbookKind: "tssWorksheet";
    readonly smartHeaderIdVersion: "smartHeaderIdV1";
    readonly sheets: {
        readonly lists: {
            readonly id: "lists";
            readonly expectedNames: readonly ["_Lists"];
            readonly aliases: readonly ["Lists", "Dropdown Lists", "_lists"];
            readonly hidden: true;
            readonly resolutionMode: "exactOrAlias";
            readonly headerIdStrategy: {
                readonly normalize: "smartHeaderIdV1";
                readonly collisionPolicy: "preferExactThenAliasThenLeftmost";
            };
        };
        readonly cover: {
            readonly id: "cover";
            readonly expectedNames: readonly ["1. Cover Sheet"];
            readonly aliases: readonly ["Cover Sheet", "Client Cover Sheet", "1 Cover Sheet"];
            readonly resolutionMode: "exactOrAlias";
        };
        readonly housingPlan: {
            readonly id: "housingPlan";
            readonly expectedNames: readonly ["4. Housing Plan"];
            readonly aliases: readonly ["Housing Plan", "4 Housing Plan", "Plan"];
            readonly resolutionMode: "exactOrAlias";
            readonly headerIdStrategy: {
                readonly normalize: "smartHeaderIdV1";
                readonly collisionPolicy: "preferExactThenAliasThenLeftmost";
            };
        };
        readonly progressNotes: {
            readonly id: "progressNotes";
            readonly expectedNames: readonly ["6. Progress Notes", "Progress Notes"];
            readonly aliases: readonly ["Progress Notes", "Notes", "Service Notes", "6 Progress Notes"];
            readonly resolutionMode: "exactOrAlias";
            readonly headerIdStrategy: {
                readonly normalize: "smartHeaderIdV1";
                readonly collisionPolicy: "preferExactThenAliasThenLeftmost";
            };
        };
        readonly budget: {
            readonly id: "budget";
            readonly expectedNames: readonly ["Budget"];
            readonly aliases: readonly ["Client Budget", "Monthly Budget"];
            readonly resolutionMode: "exactOrAlias";
            readonly headerIdStrategy: {
                readonly normalize: "smartHeaderIdV1";
                readonly collisionPolicy: "preferExactThenAliasThenLeftmost";
            };
        };
    };
    readonly variantRules: readonly [{
        readonly variant: TssWorkbookVariant;
        readonly ifSheetExists: "6. Progress Notes";
        readonly notes: "Full worksheet. Progress Notes header usually row 3; Housing Plan goal table usually starts row 22.";
    }, {
        readonly variant: TssWorkbookVariant;
        readonly ifSheetExists: "Progress Notes";
        readonly notes: "Simplified worksheet. Progress Notes header usually row 1; Housing Plan goal table usually starts row 19.";
    }];
    readonly dropdownLists: {
        yesNo: {
            id: string;
            sheetId: string;
            namedRange: string;
            expectedHeader: string;
            expectedColumn: string;
            values: string[];
        };
        providerChoice: {
            id: string;
            sheetId: string;
            namedRange: string;
            expectedHeader: string;
            expectedColumn: string;
            values: string[];
        };
        supportItem: {
            id: string;
            sheetId: string;
            namedRange: string;
            expectedHeader: string;
            expectedColumn: string;
            values: string[];
        };
        serviceTier: {
            id: string;
            sheetId: string;
            namedRange: string;
            expectedHeader: string;
            expectedColumn: string;
            values: string[];
        };
        method: {
            id: string;
            sheetId: string;
            namedRange: string;
            expectedHeader: string;
            expectedColumn: string;
            values: string[];
        };
        placeOfService: {
            id: string;
            sheetId: string;
            namedRange: string;
            expectedHeader: string;
            expectedColumn: string;
            values: string[];
        };
        statusList: {
            id: string;
            sheetId: string;
            namedRange: string;
            expectedHeader: string;
            expectedColumn: string;
            values: string[];
        };
        hardshipDetermination: {
            id: string;
            sheetId: string;
            namedRange: string;
            expectedHeader: string;
            expectedColumn: string;
            values: string[];
        };
        finalStatus: {
            id: string;
            sheetId: string;
            namedRange: string;
            expectedHeader: string;
            expectedColumn: string;
            values: string[];
        };
        denialReason: {
            id: string;
            sheetId: string;
            namedRange: string;
            expectedHeader: string;
            expectedColumn: string;
            values: string[];
        };
        actionTaken: {
            id: string;
            sheetId: string;
            namedRange: string;
            expectedHeader: string;
            expectedColumn: string;
            values: string[];
        };
        contactMethod: {
            id: string;
            sheetId: string;
            namedRange: string;
            expectedHeader: string;
            expectedColumn: string;
            values: string[];
        };
        clientResponse: {
            id: string;
            sheetId: string;
            namedRange: string;
            expectedHeader: string;
            expectedColumn: string;
            values: string[];
        };
        responsibleParty: {
            id: string;
            inlineValues: true;
            values: string[];
        };
        appointmentLocation: {
            id: string;
            inlineValues: true;
            values: string[];
        };
    };
    readonly headerAliases: {
        readonly clientName: readonly ["Client Name", "Member Name", "Customer Name", "Participant Name"];
        readonly dob: readonly ["DOB", "Date of Birth"];
        readonly hmisCwId: readonly ["HMIS/CW ID", "HMIS ID", "CWID", "CaseWorthy ID", "Caseworthy ID", "HMIS/CWID"];
        readonly medicaidId: readonly ["Medicaid ID", "MA ID", "Montana Medicaid ID"];
        readonly primaryCaseManager: readonly ["Primary CM", "Case Manager", "Primary Case Manager", "Staff Name"];
        readonly phone: readonly ["Phone", "Phone Number", "Client Phone"];
        readonly email: readonly ["Email", "Email Address", "Client Email"];
        readonly providerSelection: readonly ["Provider Selection", "Provider Choice"];
        readonly otherProviderName: readonly ["If Other, Provider Name", "Other Provider Name", "Provider Name"];
        readonly quickLinks: readonly ["Quick Links (paste URLs to tabs/docs)", "Quick Links", "Links"];
        readonly currentPaNumber: readonly ["Current PA Number", "PA Number", "Prior Authorization Number"];
        readonly paEffective: readonly ["PA Effective", "PA Effective Date", "Authorization Start"];
        readonly paExpiration: readonly ["PA Expiration", "PA Expiration Date", "Authorization End"];
        readonly next120DayReviewDue: readonly ["Next 120-day Review Due", "Review Due (≤120 days)", "Next Review Due"];
        readonly nextAnnualReAuthDue: readonly ["Next Annual Re-Auth Due", "Next Annual Reauth Due", "Annual Re-Authorization Due"];
        readonly planDate: readonly ["Plan Date", "Housing Plan Date"];
        readonly reviewDue: readonly ["Review Due (≤120 days)", "Review Due", "Next Review Due"];
        readonly clientStrengths: readonly ["Client Strengths", "Strengths", "Customer Strengths"];
        readonly cmSummary: readonly ["CM Summary", "Case Manager Summary", "Staff Summary"];
        readonly barrier: readonly ["Barrier", "Housing Barrier", "Housing Barriers"];
        readonly mitigationSupports: readonly ["Mitigation/Supports", "Mitigation Supports", "Supports", "Plan to Address Barrier"];
        readonly serviceTier: readonly ["Service Tier (U1/U2/U3)", "Service Tier: cheatsheets here and here ", "Service Tier", "Tier"];
        readonly goalSmart: readonly ["Goal (SMART)", "SMART Goal", "Goal"];
        readonly objective: readonly ["Objective", "Objectives"];
        readonly interventionTask: readonly ["Intervention/Task", "Intervention", "Task"];
        readonly goalCompletionCriteria: readonly ["Goal Completion Criteria", "Completion Criteria", "Success Criteria"];
        readonly responsible: readonly ["Responsible", "Responsible Party", "Owner"];
        readonly targetDate: readonly ["Target Date", "Due Date"];
        readonly status: readonly ["Status", "Goal Status"];
        readonly notes: readonly ["Notes", "Goal Notes"];
        readonly progressDate: readonly ["Date", "Service Date", "Note Date"];
        readonly startTime: readonly ["Start Time"];
        readonly endTime: readonly ["End Time"];
        readonly totalTime: readonly ["Total Time", "Duration"];
        readonly summary: readonly ["Summary (what & why)", "Summary", "Note Summary"];
        readonly clientResponseProgress: readonly ["Client Response/Progress", "Client Response", "Progress"];
        readonly linkedPlanGoal: readonly ["Linked Plan Goal", "Linked Goal", "Goal #"];
        readonly location: readonly ["Location of appointment", "Location", "Appointment Location"];
        readonly staffName: readonly ["Staff name ", "Staff Name", "Staff"];
        readonly staffInitial: readonly ["Staff initial", "Staff Initial", "Staff Initials"];
        readonly staffSignature: readonly ["Staff signature", "Staff Signature", "Signature"];
        readonly completionDate: readonly ["Date of completion", "Completion Date"];
    };
    readonly entities: {
        readonly coverSheet: {
            [x: string]: unknown;
            id: string;
            label: string;
            section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
            renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
            direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
            source: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            };
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            dropdowns?: Record<string, string> | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
            variantOverrides?: Record<string, {
                [x: string]: unknown;
                source?: {
                    [x: string]: unknown;
                    sheetId?: string | undefined;
                    range?: {
                        [x: string]: unknown;
                        sheetId: string;
                        anchorText?: string | undefined;
                        headerRow?: number | undefined;
                        headerRowCandidates?: number[] | undefined;
                        headerScan?: {
                            [x: string]: unknown;
                            mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                            minRow: number;
                            maxRow: number;
                            mustContainHeaderIds: string[];
                            scoreHeaderIds?: string[] | undefined;
                        } | undefined;
                        dataStartRowOffset?: number | undefined;
                        dataStartRow?: number | undefined;
                        dataEnd?: {
                            [x: string]: unknown;
                            mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                            fixedRow?: number | undefined;
                            nextAnchorText?: string | undefined;
                            minConsecutiveBlankRows?: number | undefined;
                        } | undefined;
                        expectedColumns?: string[] | undefined;
                    } | undefined;
                    keyValues?: {
                        [x: string]: unknown;
                        id: string;
                        label: string;
                        appField: string;
                        dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                        aliases?: string[] | undefined;
                        clientDocField?: string | undefined;
                        sheetLabelCell?: string | undefined;
                        sheetValueCell?: string | undefined;
                        labelSearch?: {
                            [x: string]: unknown;
                            sheetId: string;
                            labelAliases: string[];
                            scanRange: string;
                            valueOffset?: {
                                rows: number;
                                cols: number;
                            } | undefined;
                            fallbackValueOffsets?: {
                                rows: number;
                                cols: number;
                            }[] | undefined;
                        } | undefined;
                        tunnelToClientDoc?: boolean | undefined;
                        required?: boolean | undefined;
                    }[] | undefined;
                    staticContent?: unknown;
                } | undefined;
                fields?: {
                    [x: string]: unknown;
                    id: string;
                    expected: string;
                    aliases?: string[] | undefined;
                    required?: boolean | undefined;
                    dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                    optionSourceId?: string | undefined;
                    appField?: string | undefined;
                    clientDocField?: string | undefined;
                    display?: {
                        [x: string]: unknown;
                        label?: string | undefined;
                        width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                        multiline?: boolean | undefined;
                        hideInCompact?: boolean | undefined;
                        badge?: boolean | undefined;
                    } | undefined;
                    write?: {
                        [x: string]: unknown;
                        enabled: boolean;
                        lockIfFormula?: boolean | undefined;
                    } | undefined;
                }[] | undefined;
                display?: {
                    [x: string]: unknown;
                    titleField?: string | undefined;
                    subtitleField?: string | undefined;
                    emptyState?: string | undefined;
                    compactFields?: string[] | undefined;
                    sort?: {
                        field: string;
                        direction: "asc" | "desc";
                    }[] | undefined;
                    groupBy?: string | undefined;
                    totalFields?: string[] | undefined;
                } | undefined;
            }> | undefined;
        };
        readonly customerStrengths: {
            [x: string]: unknown;
            id: string;
            label: string;
            section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
            renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
            direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
            source: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            };
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            dropdowns?: Record<string, string> | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
            variantOverrides?: Record<string, {
                [x: string]: unknown;
                source?: {
                    [x: string]: unknown;
                    sheetId?: string | undefined;
                    range?: {
                        [x: string]: unknown;
                        sheetId: string;
                        anchorText?: string | undefined;
                        headerRow?: number | undefined;
                        headerRowCandidates?: number[] | undefined;
                        headerScan?: {
                            [x: string]: unknown;
                            mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                            minRow: number;
                            maxRow: number;
                            mustContainHeaderIds: string[];
                            scoreHeaderIds?: string[] | undefined;
                        } | undefined;
                        dataStartRowOffset?: number | undefined;
                        dataStartRow?: number | undefined;
                        dataEnd?: {
                            [x: string]: unknown;
                            mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                            fixedRow?: number | undefined;
                            nextAnchorText?: string | undefined;
                            minConsecutiveBlankRows?: number | undefined;
                        } | undefined;
                        expectedColumns?: string[] | undefined;
                    } | undefined;
                    keyValues?: {
                        [x: string]: unknown;
                        id: string;
                        label: string;
                        appField: string;
                        dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                        aliases?: string[] | undefined;
                        clientDocField?: string | undefined;
                        sheetLabelCell?: string | undefined;
                        sheetValueCell?: string | undefined;
                        labelSearch?: {
                            [x: string]: unknown;
                            sheetId: string;
                            labelAliases: string[];
                            scanRange: string;
                            valueOffset?: {
                                rows: number;
                                cols: number;
                            } | undefined;
                            fallbackValueOffsets?: {
                                rows: number;
                                cols: number;
                            }[] | undefined;
                        } | undefined;
                        tunnelToClientDoc?: boolean | undefined;
                        required?: boolean | undefined;
                    }[] | undefined;
                    staticContent?: unknown;
                } | undefined;
                fields?: {
                    [x: string]: unknown;
                    id: string;
                    expected: string;
                    aliases?: string[] | undefined;
                    required?: boolean | undefined;
                    dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                    optionSourceId?: string | undefined;
                    appField?: string | undefined;
                    clientDocField?: string | undefined;
                    display?: {
                        [x: string]: unknown;
                        label?: string | undefined;
                        width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                        multiline?: boolean | undefined;
                        hideInCompact?: boolean | undefined;
                        badge?: boolean | undefined;
                    } | undefined;
                    write?: {
                        [x: string]: unknown;
                        enabled: boolean;
                        lockIfFormula?: boolean | undefined;
                    } | undefined;
                }[] | undefined;
                display?: {
                    [x: string]: unknown;
                    titleField?: string | undefined;
                    subtitleField?: string | undefined;
                    emptyState?: string | undefined;
                    compactFields?: string[] | undefined;
                    sort?: {
                        field: string;
                        direction: "asc" | "desc";
                    }[] | undefined;
                    groupBy?: string | undefined;
                    totalFields?: string[] | undefined;
                } | undefined;
            }> | undefined;
        };
        readonly housingBarriers: {
            [x: string]: unknown;
            id: string;
            label: string;
            section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
            renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
            direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
            source: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            };
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            dropdowns?: Record<string, string> | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
            variantOverrides?: Record<string, {
                [x: string]: unknown;
                source?: {
                    [x: string]: unknown;
                    sheetId?: string | undefined;
                    range?: {
                        [x: string]: unknown;
                        sheetId: string;
                        anchorText?: string | undefined;
                        headerRow?: number | undefined;
                        headerRowCandidates?: number[] | undefined;
                        headerScan?: {
                            [x: string]: unknown;
                            mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                            minRow: number;
                            maxRow: number;
                            mustContainHeaderIds: string[];
                            scoreHeaderIds?: string[] | undefined;
                        } | undefined;
                        dataStartRowOffset?: number | undefined;
                        dataStartRow?: number | undefined;
                        dataEnd?: {
                            [x: string]: unknown;
                            mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                            fixedRow?: number | undefined;
                            nextAnchorText?: string | undefined;
                            minConsecutiveBlankRows?: number | undefined;
                        } | undefined;
                        expectedColumns?: string[] | undefined;
                    } | undefined;
                    keyValues?: {
                        [x: string]: unknown;
                        id: string;
                        label: string;
                        appField: string;
                        dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                        aliases?: string[] | undefined;
                        clientDocField?: string | undefined;
                        sheetLabelCell?: string | undefined;
                        sheetValueCell?: string | undefined;
                        labelSearch?: {
                            [x: string]: unknown;
                            sheetId: string;
                            labelAliases: string[];
                            scanRange: string;
                            valueOffset?: {
                                rows: number;
                                cols: number;
                            } | undefined;
                            fallbackValueOffsets?: {
                                rows: number;
                                cols: number;
                            }[] | undefined;
                        } | undefined;
                        tunnelToClientDoc?: boolean | undefined;
                        required?: boolean | undefined;
                    }[] | undefined;
                    staticContent?: unknown;
                } | undefined;
                fields?: {
                    [x: string]: unknown;
                    id: string;
                    expected: string;
                    aliases?: string[] | undefined;
                    required?: boolean | undefined;
                    dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                    optionSourceId?: string | undefined;
                    appField?: string | undefined;
                    clientDocField?: string | undefined;
                    display?: {
                        [x: string]: unknown;
                        label?: string | undefined;
                        width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                        multiline?: boolean | undefined;
                        hideInCompact?: boolean | undefined;
                        badge?: boolean | undefined;
                    } | undefined;
                    write?: {
                        [x: string]: unknown;
                        enabled: boolean;
                        lockIfFormula?: boolean | undefined;
                    } | undefined;
                }[] | undefined;
                display?: {
                    [x: string]: unknown;
                    titleField?: string | undefined;
                    subtitleField?: string | undefined;
                    emptyState?: string | undefined;
                    compactFields?: string[] | undefined;
                    sort?: {
                        field: string;
                        direction: "asc" | "desc";
                    }[] | undefined;
                    groupBy?: string | undefined;
                    totalFields?: string[] | undefined;
                } | undefined;
            }> | undefined;
        };
        readonly goals: {
            [x: string]: unknown;
            id: string;
            label: string;
            section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
            renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
            direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
            source: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            };
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            dropdowns?: Record<string, string> | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
            variantOverrides?: Record<string, {
                [x: string]: unknown;
                source?: {
                    [x: string]: unknown;
                    sheetId?: string | undefined;
                    range?: {
                        [x: string]: unknown;
                        sheetId: string;
                        anchorText?: string | undefined;
                        headerRow?: number | undefined;
                        headerRowCandidates?: number[] | undefined;
                        headerScan?: {
                            [x: string]: unknown;
                            mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                            minRow: number;
                            maxRow: number;
                            mustContainHeaderIds: string[];
                            scoreHeaderIds?: string[] | undefined;
                        } | undefined;
                        dataStartRowOffset?: number | undefined;
                        dataStartRow?: number | undefined;
                        dataEnd?: {
                            [x: string]: unknown;
                            mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                            fixedRow?: number | undefined;
                            nextAnchorText?: string | undefined;
                            minConsecutiveBlankRows?: number | undefined;
                        } | undefined;
                        expectedColumns?: string[] | undefined;
                    } | undefined;
                    keyValues?: {
                        [x: string]: unknown;
                        id: string;
                        label: string;
                        appField: string;
                        dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                        aliases?: string[] | undefined;
                        clientDocField?: string | undefined;
                        sheetLabelCell?: string | undefined;
                        sheetValueCell?: string | undefined;
                        labelSearch?: {
                            [x: string]: unknown;
                            sheetId: string;
                            labelAliases: string[];
                            scanRange: string;
                            valueOffset?: {
                                rows: number;
                                cols: number;
                            } | undefined;
                            fallbackValueOffsets?: {
                                rows: number;
                                cols: number;
                            }[] | undefined;
                        } | undefined;
                        tunnelToClientDoc?: boolean | undefined;
                        required?: boolean | undefined;
                    }[] | undefined;
                    staticContent?: unknown;
                } | undefined;
                fields?: {
                    [x: string]: unknown;
                    id: string;
                    expected: string;
                    aliases?: string[] | undefined;
                    required?: boolean | undefined;
                    dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                    optionSourceId?: string | undefined;
                    appField?: string | undefined;
                    clientDocField?: string | undefined;
                    display?: {
                        [x: string]: unknown;
                        label?: string | undefined;
                        width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                        multiline?: boolean | undefined;
                        hideInCompact?: boolean | undefined;
                        badge?: boolean | undefined;
                    } | undefined;
                    write?: {
                        [x: string]: unknown;
                        enabled: boolean;
                        lockIfFormula?: boolean | undefined;
                    } | undefined;
                }[] | undefined;
                display?: {
                    [x: string]: unknown;
                    titleField?: string | undefined;
                    subtitleField?: string | undefined;
                    emptyState?: string | undefined;
                    compactFields?: string[] | undefined;
                    sort?: {
                        field: string;
                        direction: "asc" | "desc";
                    }[] | undefined;
                    groupBy?: string | undefined;
                    totalFields?: string[] | undefined;
                } | undefined;
            }> | undefined;
        };
        readonly smartGoalsAcronym: {
            [x: string]: unknown;
            id: string;
            label: string;
            section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
            renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
            direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
            source: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            };
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            dropdowns?: Record<string, string> | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
            variantOverrides?: Record<string, {
                [x: string]: unknown;
                source?: {
                    [x: string]: unknown;
                    sheetId?: string | undefined;
                    range?: {
                        [x: string]: unknown;
                        sheetId: string;
                        anchorText?: string | undefined;
                        headerRow?: number | undefined;
                        headerRowCandidates?: number[] | undefined;
                        headerScan?: {
                            [x: string]: unknown;
                            mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                            minRow: number;
                            maxRow: number;
                            mustContainHeaderIds: string[];
                            scoreHeaderIds?: string[] | undefined;
                        } | undefined;
                        dataStartRowOffset?: number | undefined;
                        dataStartRow?: number | undefined;
                        dataEnd?: {
                            [x: string]: unknown;
                            mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                            fixedRow?: number | undefined;
                            nextAnchorText?: string | undefined;
                            minConsecutiveBlankRows?: number | undefined;
                        } | undefined;
                        expectedColumns?: string[] | undefined;
                    } | undefined;
                    keyValues?: {
                        [x: string]: unknown;
                        id: string;
                        label: string;
                        appField: string;
                        dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                        aliases?: string[] | undefined;
                        clientDocField?: string | undefined;
                        sheetLabelCell?: string | undefined;
                        sheetValueCell?: string | undefined;
                        labelSearch?: {
                            [x: string]: unknown;
                            sheetId: string;
                            labelAliases: string[];
                            scanRange: string;
                            valueOffset?: {
                                rows: number;
                                cols: number;
                            } | undefined;
                            fallbackValueOffsets?: {
                                rows: number;
                                cols: number;
                            }[] | undefined;
                        } | undefined;
                        tunnelToClientDoc?: boolean | undefined;
                        required?: boolean | undefined;
                    }[] | undefined;
                    staticContent?: unknown;
                } | undefined;
                fields?: {
                    [x: string]: unknown;
                    id: string;
                    expected: string;
                    aliases?: string[] | undefined;
                    required?: boolean | undefined;
                    dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                    optionSourceId?: string | undefined;
                    appField?: string | undefined;
                    clientDocField?: string | undefined;
                    display?: {
                        [x: string]: unknown;
                        label?: string | undefined;
                        width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                        multiline?: boolean | undefined;
                        hideInCompact?: boolean | undefined;
                        badge?: boolean | undefined;
                    } | undefined;
                    write?: {
                        [x: string]: unknown;
                        enabled: boolean;
                        lockIfFormula?: boolean | undefined;
                    } | undefined;
                }[] | undefined;
                display?: {
                    [x: string]: unknown;
                    titleField?: string | undefined;
                    subtitleField?: string | undefined;
                    emptyState?: string | undefined;
                    compactFields?: string[] | undefined;
                    sort?: {
                        field: string;
                        direction: "asc" | "desc";
                    }[] | undefined;
                    groupBy?: string | undefined;
                    totalFields?: string[] | undefined;
                } | undefined;
            }> | undefined;
        };
        readonly progressNotes: {
            [x: string]: unknown;
            id: string;
            label: string;
            section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
            renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
            direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
            source: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            };
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            dropdowns?: Record<string, string> | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
            variantOverrides?: Record<string, {
                [x: string]: unknown;
                source?: {
                    [x: string]: unknown;
                    sheetId?: string | undefined;
                    range?: {
                        [x: string]: unknown;
                        sheetId: string;
                        anchorText?: string | undefined;
                        headerRow?: number | undefined;
                        headerRowCandidates?: number[] | undefined;
                        headerScan?: {
                            [x: string]: unknown;
                            mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                            minRow: number;
                            maxRow: number;
                            mustContainHeaderIds: string[];
                            scoreHeaderIds?: string[] | undefined;
                        } | undefined;
                        dataStartRowOffset?: number | undefined;
                        dataStartRow?: number | undefined;
                        dataEnd?: {
                            [x: string]: unknown;
                            mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                            fixedRow?: number | undefined;
                            nextAnchorText?: string | undefined;
                            minConsecutiveBlankRows?: number | undefined;
                        } | undefined;
                        expectedColumns?: string[] | undefined;
                    } | undefined;
                    keyValues?: {
                        [x: string]: unknown;
                        id: string;
                        label: string;
                        appField: string;
                        dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                        aliases?: string[] | undefined;
                        clientDocField?: string | undefined;
                        sheetLabelCell?: string | undefined;
                        sheetValueCell?: string | undefined;
                        labelSearch?: {
                            [x: string]: unknown;
                            sheetId: string;
                            labelAliases: string[];
                            scanRange: string;
                            valueOffset?: {
                                rows: number;
                                cols: number;
                            } | undefined;
                            fallbackValueOffsets?: {
                                rows: number;
                                cols: number;
                            }[] | undefined;
                        } | undefined;
                        tunnelToClientDoc?: boolean | undefined;
                        required?: boolean | undefined;
                    }[] | undefined;
                    staticContent?: unknown;
                } | undefined;
                fields?: {
                    [x: string]: unknown;
                    id: string;
                    expected: string;
                    aliases?: string[] | undefined;
                    required?: boolean | undefined;
                    dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                    optionSourceId?: string | undefined;
                    appField?: string | undefined;
                    clientDocField?: string | undefined;
                    display?: {
                        [x: string]: unknown;
                        label?: string | undefined;
                        width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                        multiline?: boolean | undefined;
                        hideInCompact?: boolean | undefined;
                        badge?: boolean | undefined;
                    } | undefined;
                    write?: {
                        [x: string]: unknown;
                        enabled: boolean;
                        lockIfFormula?: boolean | undefined;
                    } | undefined;
                }[] | undefined;
                display?: {
                    [x: string]: unknown;
                    titleField?: string | undefined;
                    subtitleField?: string | undefined;
                    emptyState?: string | undefined;
                    compactFields?: string[] | undefined;
                    sort?: {
                        field: string;
                        direction: "asc" | "desc";
                    }[] | undefined;
                    groupBy?: string | undefined;
                    totalFields?: string[] | undefined;
                } | undefined;
            }> | undefined;
        };
        readonly budget: {
            [x: string]: unknown;
            id: string;
            label: string;
            section: "notes" | "budget" | "cover" | "housingPlan" | "reference";
            renderKind: "keyValueCard" | "summaryBox" | "sectionedTable" | "dataTable" | "budgetTable" | "acronymCard";
            direction: "worksheetToApp" | "appToWorksheet" | "bidirectional";
            source: {
                [x: string]: unknown;
                sheetId?: string | undefined;
                range?: {
                    [x: string]: unknown;
                    sheetId: string;
                    anchorText?: string | undefined;
                    headerRow?: number | undefined;
                    headerRowCandidates?: number[] | undefined;
                    headerScan?: {
                        [x: string]: unknown;
                        mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                        minRow: number;
                        maxRow: number;
                        mustContainHeaderIds: string[];
                        scoreHeaderIds?: string[] | undefined;
                    } | undefined;
                    dataStartRowOffset?: number | undefined;
                    dataStartRow?: number | undefined;
                    dataEnd?: {
                        [x: string]: unknown;
                        mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                        fixedRow?: number | undefined;
                        nextAnchorText?: string | undefined;
                        minConsecutiveBlankRows?: number | undefined;
                    } | undefined;
                    expectedColumns?: string[] | undefined;
                } | undefined;
                keyValues?: {
                    [x: string]: unknown;
                    id: string;
                    label: string;
                    appField: string;
                    dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                    aliases?: string[] | undefined;
                    clientDocField?: string | undefined;
                    sheetLabelCell?: string | undefined;
                    sheetValueCell?: string | undefined;
                    labelSearch?: {
                        [x: string]: unknown;
                        sheetId: string;
                        labelAliases: string[];
                        scanRange: string;
                        valueOffset?: {
                            rows: number;
                            cols: number;
                        } | undefined;
                        fallbackValueOffsets?: {
                            rows: number;
                            cols: number;
                        }[] | undefined;
                    } | undefined;
                    tunnelToClientDoc?: boolean | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                staticContent?: unknown;
            };
            fields?: {
                [x: string]: unknown;
                id: string;
                expected: string;
                aliases?: string[] | undefined;
                required?: boolean | undefined;
                dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                optionSourceId?: string | undefined;
                appField?: string | undefined;
                clientDocField?: string | undefined;
                display?: {
                    [x: string]: unknown;
                    label?: string | undefined;
                    width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                    multiline?: boolean | undefined;
                    hideInCompact?: boolean | undefined;
                    badge?: boolean | undefined;
                } | undefined;
                write?: {
                    [x: string]: unknown;
                    enabled: boolean;
                    lockIfFormula?: boolean | undefined;
                } | undefined;
            }[] | undefined;
            dropdowns?: Record<string, string> | undefined;
            display?: {
                [x: string]: unknown;
                titleField?: string | undefined;
                subtitleField?: string | undefined;
                emptyState?: string | undefined;
                compactFields?: string[] | undefined;
                sort?: {
                    field: string;
                    direction: "asc" | "desc";
                }[] | undefined;
                groupBy?: string | undefined;
                totalFields?: string[] | undefined;
            } | undefined;
            variantOverrides?: Record<string, {
                [x: string]: unknown;
                source?: {
                    [x: string]: unknown;
                    sheetId?: string | undefined;
                    range?: {
                        [x: string]: unknown;
                        sheetId: string;
                        anchorText?: string | undefined;
                        headerRow?: number | undefined;
                        headerRowCandidates?: number[] | undefined;
                        headerScan?: {
                            [x: string]: unknown;
                            mode: "fixedRowPreferred" | "anchorThenOffset" | "scanWindow";
                            minRow: number;
                            maxRow: number;
                            mustContainHeaderIds: string[];
                            scoreHeaderIds?: string[] | undefined;
                        } | undefined;
                        dataStartRowOffset?: number | undefined;
                        dataStartRow?: number | undefined;
                        dataEnd?: {
                            [x: string]: unknown;
                            mode: "firstBlankRow" | "untilNextAnchor" | "fixedRow" | "worksheetUsedRange";
                            fixedRow?: number | undefined;
                            nextAnchorText?: string | undefined;
                            minConsecutiveBlankRows?: number | undefined;
                        } | undefined;
                        expectedColumns?: string[] | undefined;
                    } | undefined;
                    keyValues?: {
                        [x: string]: unknown;
                        id: string;
                        label: string;
                        appField: string;
                        dataType: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature";
                        aliases?: string[] | undefined;
                        clientDocField?: string | undefined;
                        sheetLabelCell?: string | undefined;
                        sheetValueCell?: string | undefined;
                        labelSearch?: {
                            [x: string]: unknown;
                            sheetId: string;
                            labelAliases: string[];
                            scanRange: string;
                            valueOffset?: {
                                rows: number;
                                cols: number;
                            } | undefined;
                            fallbackValueOffsets?: {
                                rows: number;
                                cols: number;
                            }[] | undefined;
                        } | undefined;
                        tunnelToClientDoc?: boolean | undefined;
                        required?: boolean | undefined;
                    }[] | undefined;
                    staticContent?: unknown;
                } | undefined;
                fields?: {
                    [x: string]: unknown;
                    id: string;
                    expected: string;
                    aliases?: string[] | undefined;
                    required?: boolean | undefined;
                    dataType?: "string" | "number" | "date" | "computed" | "url" | "duration" | "currency" | "select" | "longText" | "time" | "signature" | undefined;
                    optionSourceId?: string | undefined;
                    appField?: string | undefined;
                    clientDocField?: string | undefined;
                    display?: {
                        [x: string]: unknown;
                        label?: string | undefined;
                        width?: "sm" | "md" | "lg" | "xs" | "xl" | undefined;
                        multiline?: boolean | undefined;
                        hideInCompact?: boolean | undefined;
                        badge?: boolean | undefined;
                    } | undefined;
                    write?: {
                        [x: string]: unknown;
                        enabled: boolean;
                        lockIfFormula?: boolean | undefined;
                    } | undefined;
                }[] | undefined;
                display?: {
                    [x: string]: unknown;
                    titleField?: string | undefined;
                    subtitleField?: string | undefined;
                    emptyState?: string | undefined;
                    compactFields?: string[] | undefined;
                    sort?: {
                        field: string;
                        direction: "asc" | "desc";
                    }[] | undefined;
                    groupBy?: string | undefined;
                    totalFields?: string[] | undefined;
                } | undefined;
            }> | undefined;
        };
    };
    readonly parsingDefaults: {
        readonly rowDriftTolerance: 8;
        readonly emptyRowPolicy: "skipRowsWhereAllMappedFieldsBlank";
        readonly mergedCellPolicy: "topLeftValueAppliesToMergedRange";
        readonly coverSheetTunnelPolicy: "sheetValueOverridesClientDocWhenNonBlank";
        readonly datePolicy: "excelSerialOrIsoToIsoDate";
    };
};
/**
 * Produces the effective TSS worksheet config for an org by deep-merging the
 * baseline with the org's stored override. The baseline is never mutated.
 *
 * @param override  Validated org override (or null/undefined for the baseline).
 * @returns A fully-mutable effective config.
 */
export declare function resolveTssWorksheetConfig(override?: TssOrgConfigOverride | null): TssWorksheetConfig;
/**
 * Resolves the effective workbook variant. The override's `forceVariant` wins
 * over the variant auto-detected from sheet names; otherwise the detected
 * variant is used, falling back to "unknown".
 */
export declare function resolveWorkbookVariant(override?: TssOrgConfigOverride | null, detectedVariant?: TssWorkbookVariant | null): TssWorkbookVariant;
