// src/app/(protected)/budget/pipeline/[pipelineId]/page.tsx
"use client";
import React from "react";
import { PipelineBuilderPage } from "@features/budgetPipeline/PipelineBuilderPage";

type Props = { params: { pipelineId: string } };

export default function Page({ params }: Props) {
  const { pipelineId } = params;
  return (
    <div className="h-full flex flex-col">
      <PipelineBuilderPage pipelineId={pipelineId === "new" ? null : pipelineId} />
    </div>
  );
}
