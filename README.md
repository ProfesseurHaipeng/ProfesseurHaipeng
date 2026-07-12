# Professeur Haipeng

### Building inspectable AI Skills for safer, more portable agent workflows

I am Haipeng, an independent builder learning in public. I make small AI tools
that people can read, test, and verify before trusting them.

My current focus is Agent Skill quality: structure, portability, evaluation,
run-budget controls, and local-first workflows.

> Evidence over unsupported claims. Useful releases over large promises.

## Start here

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

1. Improve Portable Skill Doctor with community-submitted synthetic failures.
2. Build an `agent-run-budget-guard` Skill for preflight limits on calls,
   tokens, concurrency, and elapsed time.
3. Release one focused, tested AI Skill at a time.

If this direction is useful, star or watch
[Professeur AI Skills](https://github.com/ProfesseurHaipeng/professeur-ai-skills)
and open an issue with the smallest reproducible Skill failure you can share.

## 中文

我是海鹏，也使用 **Professeur Haipeng** 这个名字。我正在公开学习和构建可检查、可测试、可复用的 AI Skills；每次只发布一个范围清楚、证据完整的小工具。
