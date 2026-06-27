import graphData from "../data/graph.json"

export interface GraphNode {
  url: string
  title: string
  kind: string
}
export interface GraphEdge {
  source: string
  target: string
}
interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  backlinks: Record<string, string[]>
}

export const graph = graphData as Graph
const byUrl = new Map(graph.nodes.map((n) => [n.url, n]))

/** Pages that link TO `url` (backlinks, §10.2), resolved to nodes. */
export function backlinksFor(url: string): GraphNode[] {
  return (graph.backlinks[url] ?? [])
    .map((u) => byUrl.get(u))
    .filter((n): n is GraphNode => Boolean(n))
}

/** The current node plus its forward + backward neighbours (local graph, §10.2). */
export function neighborhood(url: string): { nodes: GraphNode[]; links: GraphEdge[] } {
  const links = graph.edges.filter((e) => e.source === url || e.target === url)
  const urls = new Set<string>([url])
  for (const e of links) {
    urls.add(e.source)
    urls.add(e.target)
  }
  const nodes = [...urls].map((u) => byUrl.get(u)).filter((n): n is GraphNode => Boolean(n))
  return { nodes, links }
}
