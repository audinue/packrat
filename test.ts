const fixtures = [
  {
    grammar: '...',
    tests: [
      {
        input: '...',
        output: '...',
      }
    ]
  }
]

const languages = ['rust', 'go', 'typescript', 'java']

const io = {
  grammarInvalid: async (/* ... */) => true,
  testInvalid: async (/* ... */) => true,
  generateGrammar: async (/* ... */) => {},
  generateTest: async (/* ... */) => {},
  compile: async (_: string[], /* ... */) => {},
  run: async (/* ... */) => {},
}

for (const _ of languages) {
  let shouldCompile = []
  for (const fixture of fixtures) {
    if (await io.grammarInvalid()) {
      shouldCompile.push('...')
      await io.generateGrammar()
    }
    for (const _ of fixture.tests) {
      if (await io.testInvalid()) {
        shouldCompile.push('...')
        await io.generateTest()
      }
    }
  }
  if (shouldCompile.length) {
    await io.compile(shouldCompile)
    await io.run()
  }
}
