// Types for seed.json, so TypeScript does not infer them from the 30+ MB file (that runs out of memory).
import type { Dataset } from "@/lib/golf/types";

declare const seed: Dataset;
export default seed;
