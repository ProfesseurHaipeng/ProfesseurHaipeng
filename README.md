# Professeur Haipeng

### Building inspectable AI Skills for research and agent workflows

I am Haipeng, an independent builder learning in public. I make small AI tools
that people can read, test, and verify before trusting them.

My current focus is local-first AI preflight: scientific-compute planning,
declared experiment readiness, Skill portability, and evaluation.

> Evidence over unsupported claims. Useful releases over large promises.

## Start here

### [AI Research Preflight](https://github.com/ProfesseurHaipeng/ai-research-preflight)

Two deterministic, local-first Agent Skills for checking research plans before
any separate execution or experiment:

- `plan-research-compute` reviews sanitized metadata, governed data locations,
  an abstract DAG, pinned tools, and bounded resources without reading data or
  launching cloud jobs;
- `check-formulation-readiness` checks user-supplied arithmetic, units, bounds,
  process order, evidence scope, and experimental gates without generating or
  optimizing a formula;
- default formulation reports are ID-only, and a ready result never means
  feasible, safe, stable, effective, or compliant;
- ships as the audited
  [`v0.1.0` release](https://github.com/ProfesseurHaipeng/ai-research-preflight/releases/tag/v0.1.0).

[![Latest release](https://img.shields.io/github/v/release/ProfesseurHaipeng/ai-research-preflight)](https://github.com/ProfesseurHaipeng/ai-research-preflight/releases/latest)
[![CI](https://github.com/ProfesseurHaipeng/ai-research-preflight/actions/workflows/ci.yml/badge.svg)](https://github.com/ProfesseurHaipeng/ai-research-preflight/actions/workflows/ci.yml)

### [Portable Skill Doctor](https://github.com/ProfesseurHaipeng/professeur-ai-skills)

A read-only static auditor for Agent Skills. It catches broken resources,
escaping paths, undeclared requirements, and Codex/GitHub Copilot portability
risks before installation or publication.

- never executes scripts from the Skill being audited;
- emits deterministic text, JSON, or SARIF;
- includes adversarial tests, public-scope gates, CodeQL, and release audits;
- ships as a pinned, installable
  [`v0.1.0` release](https://github.com/ProfesseurHaipeng/professeur-ai-skills/releases/tag/v0.1.0).

[![Latest release](https://img.shields.io/github/v/release/ProfesseurHaipeng/professeur-ai-skills)](https://github.com/ProfesseurHaipeng/professeur-ai-skills/releases/latest)
[![CI](https://github.com/ProfesseurHaipeng/professeur-ai-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/ProfesseurHaipeng/professeur-ai-skills/actions/workflows/ci.yml)

## What I am building

- inspectable Agent Skills with explicit inputs, outputs, and limits;
- local research preflights that keep private data and real formulas out of
  public repositories;
- deterministic checks for failures that prompts alone cannot catch;
- guardrails for agent cost, fan-out, concurrency, and run budgets;
- practical documentation that separates tested evidence from assumptions.

## Build principles

- Preview before install.
- Audit before explanation.
- Keep target access read-only by default.
- Publish synthetic tests, exact limitations, and reproducible checks.
- Improve from small counterexamples supplied by real users.

## Current roadmap

1. Improve both released projects with community-submitted synthetic failures.
2. Build an `agent-run-budget-guard` Skill for preflight limits on calls,
   tokens, concurrency, and elapsed time.
3. Explore focused pet-AI and research-operations Skills without publishing
   private product or formulation work.

If this direction is useful, star or watch
[AI Research Preflight](https://github.com/ProfesseurHaipeng/ai-research-preflight)
or [Professeur AI Skills](https://github.com/ProfesseurHaipeng/professeur-ai-skills),
then open an issue with the smallest synthetic failure you can share.

## 中文

我是海鹏，也使用 **Professeur Haipeng** 这个名字。我正在公开学习和构建可检查、可测试、可复用的 AI Skills。当前公开项目包括科研计算预检、配方实验就绪检查和 Skill 静态审计；真实配方、私人研发资料和原始科研数据不会进入公共仓库。
