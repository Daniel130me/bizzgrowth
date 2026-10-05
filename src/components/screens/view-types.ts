"use client";
import type { ComponentType } from "react";

export interface ScreenProps {
  /** Route params extracted from patterns like "metric/:id" -> { id: "revenue" } */
  params: Record<string, string>;
}

export type ScreenComponent = ComponentType<ScreenProps>;

export type ViewMap = Record<string, ScreenComponent>;
