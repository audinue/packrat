const profile = await Bun.file(import.meta.dir + '/profile.cpuprofile.cpuprofile').json()
const nodes = new Map<number, any>()
for (const node of profile.nodes) nodes.set(node.id, node)
const totals = new Map<number, number>()
for (const sample of profile.samples) totals.set(sample, (totals.get(sample) ?? 0) + 1)
const fnSamples = new Map<string, number>()
for (const [nodeId, count] of totals) {
  const node = nodes.get(nodeId)
  if (!node) continue
  const name = `${node.callFrame.functionName || '(anon)'} (${node.callFrame.url ?? 'native'})`
  fnSamples.set(name, (fnSamples.get(name) ?? 0) + count)
}
const sorted = [...fnSamples.entries()].sort((a, b) => b[1] - a[1])
const total = sorted.reduce((sum, [, c]) => sum + c, 0)
for (const [name, count] of sorted.slice(0, 30)) {
  console.log(`${(count / total * 100).toFixed(1).padStart(5)}% ${String(count).padStart(6)} ${name}`)
}
