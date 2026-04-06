"use client";

import React from "react";
import AssessmentBuilderTool from "@features/tools/AssessmentBuilderTool";

export function AssessmentManagerMain() {
  return (
    <div className="flex-1 overflow-auto p-4">
      <AssessmentBuilderTool />
    </div>
  );
}
