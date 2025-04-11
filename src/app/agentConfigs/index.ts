import { AllAgentConfigsType } from "@/app/types";
import interview from "./interview";

export const allAgentSets: AllAgentConfigsType = {
  interview,
};

export const defaultAgentSetKey = "interview";

export type AgentConfigName = keyof typeof allAgentSets;
