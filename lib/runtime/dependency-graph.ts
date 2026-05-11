// ═══════════════════════════════════════════════════════════════
// Dependency Graph — Tracks state dependencies for reactive updates
//
// Used by the state engine to know:
//   - Which derived states to recompute when a source changes
//   - Which UI bindings to re-evaluate
//   - Whether circular dependencies exist
// ═══════════════════════════════════════════════════════════════

export class DependencyGraph<T = string> {
  /** node → Set of nodes it depends on */
  private deps = new Map<T, Set<T>>();
  /** node → Set of nodes that depend on it (reverse index) */
  private rdeps = new Map<T, Set<T>>();

  /** Register that `node` depends on `dependency` */
  addDependency(node: T, dependency: T): void {
    if (!this.deps.has(node)) this.deps.set(node, new Set());
    this.deps.get(node)!.add(dependency);

    if (!this.rdeps.has(dependency)) this.rdeps.set(dependency, new Set());
    this.rdeps.get(dependency)!.add(node);
  }

  /** Set the full dependency list for a node (replaces previous) */
  setDependencies(node: T, dependencies: Set<T> | T[]): void {
    // Remove old reverse deps
    const oldDeps = this.deps.get(node);
    if (oldDeps) {
      for (const dep of oldDeps) {
        this.rdeps.get(dep)?.delete(node);
      }
    }

    const depSet = dependencies instanceof Set ? dependencies : new Set(dependencies);
    this.deps.set(node, depSet);

    for (const dep of depSet) {
      if (!this.rdeps.has(dep)) this.rdeps.set(dep, new Set());
      this.rdeps.get(dep)!.add(node);
    }
  }

  /** Remove a node and all its edges */
  removeNode(node: T): void {
    // Remove forward deps
    const fwd = this.deps.get(node);
    if (fwd) {
      for (const dep of fwd) {
        this.rdeps.get(dep)?.delete(node);
      }
    }
    this.deps.delete(node);

    // Remove reverse deps
    const rev = this.rdeps.get(node);
    if (rev) {
      for (const dependent of rev) {
        this.deps.get(dependent)?.delete(node);
      }
    }
    this.rdeps.delete(node);
  }

  /** What does this node depend on? */
  getDependencies(node: T): Set<T> {
    return this.deps.get(node) ?? new Set();
  }

  /** What depends on this node? (direct dependents only) */
  getDependents(node: T): Set<T> {
    return this.rdeps.get(node) ?? new Set();
  }

  /**
   * Get ALL nodes affected when `changed` nodes are modified.
   * Returns them in topological order (dependencies first).
   */
  getAffected(changed: T | T[]): T[] {
    const changedSet = Array.isArray(changed) ? new Set(changed) : new Set([changed]);
    const visited = new Set<T>();
    const result: T[] = [];

    const visit = (node: T) => {
      if (visited.has(node)) return;
      visited.add(node);

      const dependents = this.rdeps.get(node);
      if (dependents) {
        for (const dep of dependents) {
          visit(dep);
        }
      }

      result.push(node);
    };

    for (const node of changedSet) {
      visit(node);
    }

    // Return in dependency order (sources first, derived last)
    return result.reverse();
  }

  /** Detect circular dependencies. Returns the cycle path or null. */
  detectCycle(): T[] | null {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<T, number>();
    const parent = new Map<T, T | null>();

    for (const node of this.deps.keys()) {
      color.set(node, WHITE);
    }

    for (const node of this.deps.keys()) {
      if (color.get(node) === WHITE) {
        const cycle = this.dfsVisit(node, color, parent);
        if (cycle) return cycle;
      }
    }

    return null;
  }

  private dfsVisit(
    node: T,
    color: Map<T, number>,
    parent: Map<T, T | null>
  ): T[] | null {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    color.set(node, GRAY);

    const deps = this.deps.get(node);
    if (deps) {
      for (const dep of deps) {
        if (!color.has(dep)) color.set(dep, WHITE);

        if (color.get(dep) === GRAY) {
          // Found cycle — reconstruct path
          const cycle: T[] = [dep, node];
          let cur = node;
          while (cur !== dep && parent.has(cur)) {
            cur = parent.get(cur)!;
            if (cur != null) cycle.push(cur);
          }
          return cycle.reverse();
        }

        if (color.get(dep) === WHITE) {
          parent.set(dep, node);
          const cycle = this.dfsVisit(dep, color, parent);
          if (cycle) return cycle;
        }
      }
    }

    color.set(node, BLACK);
    return null;
  }

  /** Topological sort of all nodes (throws if cyclic) */
  topologicalSort(): T[] {
    const cycle = this.detectCycle();
    if (cycle) {
      throw new Error(`Circular dependency detected: ${cycle.join(" → ")}`);
    }

    const visited = new Set<T>();
    const result: T[] = [];

    const visit = (node: T) => {
      if (visited.has(node)) return;
      visited.add(node);

      const deps = this.deps.get(node);
      if (deps) {
        for (const dep of deps) visit(dep);
      }

      result.push(node);
    };

    for (const node of this.deps.keys()) {
      visit(node);
    }

    // Also include nodes that are only in rdeps (sources with no deps)
    for (const node of this.rdeps.keys()) {
      if (!visited.has(node)) {
        result.push(node);
      }
    }

    return result;
  }

  /** Get all nodes in the graph */
  getAllNodes(): Set<T> {
    const nodes = new Set<T>();
    for (const n of this.deps.keys()) nodes.add(n);
    for (const n of this.rdeps.keys()) nodes.add(n);
    return nodes;
  }

  /** Clear all data */
  clear(): void {
    this.deps.clear();
    this.rdeps.clear();
  }
}
