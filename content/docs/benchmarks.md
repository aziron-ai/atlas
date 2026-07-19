# Benchmarks and Methodology

Atlas publishes benchmark results for accuracy, token use, latency, language
compatibility, and agent workflows:

[Open the Atlas benchmark explorer](https://aziron-ai.github.io/atlas/#benchmarks)

## Download the Data

- [Processed site data](https://github.com/aziron-ai/atlas/blob/main/data/site-data.json)
- [Raw benchmark artifacts](https://github.com/aziron-ai/atlas/tree/main/data/raw)
- [Evidence manifests](https://github.com/aziron-ai/atlas/tree/main/data)
- [Agent benchmark kit](https://github.com/aziron-ai/atlas/tree/main/agent-bench)

## How to Read a Result

Confirm all of the following before comparing tools:

1. Atlas and baseline tool versions
2. repository URL and pinned commit
3. language and query set
4. hardware and operating system
5. cold-cache or warm-cache state
6. repeat count and aggregation method
7. accuracy oracle or reviewer
8. token measurement method
9. failure and timeout handling

## Evidence Categories

Do not combine these categories into one unsupported headline:

- **Compatibility:** whether a format indexes successfully
- **Correctness:** precision, recall, or F1 against an oracle
- **Latency:** elapsed index or query time under stated cache conditions
- **Token use:** measured model/tool usage or a documented estimate
- **Agent workflow:** end-to-end behavior for a pinned assistant and task set

## Important Limitations

- Fixture results do not prove production-repository accuracy.
- One repository does not establish performance across a language.
- Different assistants may consume the same MCP result differently.
- Estimated tokens are not equivalent to provider-reported token usage.
- Warm-cache query latency is not cold-start installation or indexing time.
- Language support and result quality can differ by syntax and framework.

## Reproduce Agent Tests

The public repository includes a self-contained agent benchmark guide:

```sh
python3 agent-bench/agent_token_bench.py \
  --setup \
  --agents auto \
  --qa-set agent-bench/QA_SET_logrus.json \
  --workdir agentbench-work
```

Read
[agent-bench/README.md](https://github.com/aziron-ai/atlas/blob/main/agent-bench/README.md)
for prerequisites, expected external cost, pinned inputs, and interpretation.

## Reporting a Comparison

Publish:

- exact commands
- raw machine-readable output
- all failed and timed-out cases
- environment metadata
- evidence limitations
- the Atlas release tag and checksum

Benchmark results are dated evidence under stated conditions, not a guarantee
for every repository, machine, language, or assistant.
