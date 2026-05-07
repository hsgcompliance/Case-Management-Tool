"use client";

import React from "react";
import NecromancerGame, { scanCustomersFromDOM } from "../../games/necromancer/NecromancerGame";
import type { SecretGameRuntimeProps } from "../runtimeRegistry";

type RuntimeErrorBoundaryProps = {
  children: React.ReactNode;
  onError: () => void;
};

type RuntimeErrorBoundaryState = {
  crashed: boolean;
};

class RuntimeErrorBoundary extends React.Component<RuntimeErrorBoundaryProps, RuntimeErrorBoundaryState> {
  constructor(props: RuntimeErrorBoundaryProps) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.crashed ? null : this.props.children;
  }
}

export default function NecromancerOverlayRuntime({ onRequestClose }: SecretGameRuntimeProps) {
  const [customers] = React.useState(() => scanCustomersFromDOM());

  return (
    <RuntimeErrorBoundary onError={onRequestClose}>
      <NecromancerGame customers={customers} onEnd={onRequestClose} />
    </RuntimeErrorBoundary>
  );
}
