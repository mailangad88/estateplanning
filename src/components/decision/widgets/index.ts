import type { ComponentType } from "react";
import { InheritanceTree } from "./InheritanceTree";

/** Interactive widgets a decision guide can name in `widgets`. */
export const DECISION_WIDGETS: Record<string, ComponentType> = {
  "inheritance-tree": InheritanceTree,
};
