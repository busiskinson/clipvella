"use client";

import { listProjects } from "./projects";
import { getUsage } from "./usage";
import { useQuery } from "./use-query";

export const useProjects = () => useQuery(listProjects);
export const useUsage = () => useQuery(getUsage);
