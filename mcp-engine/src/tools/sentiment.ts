import { z } from "zod";
import type { ToolDef } from "./helpers";

export const sentimentTools: ToolDef[] = [
  {
    name: "get_sentiment",
    description:
      "Position-holder weighted YES/NO sentiment for a Polymarket market (by conditionId). Weights: NetFlow 50 / Pro 30 / PnL 10 / TVL 10. EXPENSIVE — 3-min server cache, do not poll. Polymarket only. A 50/50 score means 'no data', NOT neutral conviction. Net-flow is from <=500 trades AND <=24h.",
    shape: { id: z.string().min(1).describe("Polymarket conditionId.") },
    toReq: (a) => ({ path: `/markets/polymarket/${encodeURIComponent(a.id)}/sentiment` }),
  },
];
