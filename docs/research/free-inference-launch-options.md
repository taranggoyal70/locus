# Free-inference launch options for Locus

**As of:** August 30, 2026  
**Source policy:** Current first-party provider documentation, first-party model APIs, and this repository only.

## Executive judgment

Locus can launch a **small, explicitly capped free beta** without paying for inference. It cannot credibly offer unrestricted, reliable, fully self-serve Agent Runs at zero inference cost. Every current free option is an evaluation allowance, a small daily allocation, a finite trial, or a low-priority service without a production SLA.

The strongest recurring-free path is **Cloudflare Workers AI with `@cf/qwen/qwen3.8-27b`**, capped to roughly one substantial Run per day across the product. The model has a 262,144-token context window, function calling, reasoning, and `response_format` support ([Cloudflare model page](https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/)). Workers Free supplies 10,000 neurons per day and stops requests when the allocation is exhausted; Qwen 3.8 is not among the models that require a paid billing method ([Cloudflare pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)).

That is enough for a real public demo or an invitation-only beta, not open-ended public usage. At Cloudflare's published conversion, approximately 100,000 input tokens plus 20,000 output tokens use about 9,900 neurons. One Locus Run can therefore consume most of the daily allocation.

For a genuinely self-serve public product with **zero inference spend borne by Locus**, the durable design is **bring your own provider key (BYOK)**. A user may use a free Groq/OpenRouter allowance or a paid account, while Locus keeps its own free daily pool for the guided demo. BYOK adds secret-handling and onboarding work and is less friendly to nontechnical users, so it should be optional rather than the only first-run experience.

## Fit with the current Agent Run

The current implementation can make up to 10 model steps, allows 6,000 output tokens per step, and enforces a 180,000-token default Run budget ([coding-agent.ts](../../src/lib/agent/coding-agent.ts), [run-budget.ts](../../src/lib/agent/run-budget.ts)). It uses local function tools during the loop and reserves the last step for a schema-shaped proposal. This makes three provider capabilities non-negotiable:

1. multi-turn function calling;
2. a large enough context/rate window for accumulated tool history;
3. JSON or structured output on the final tool-free step.

Free request counts alone are therefore misleading: a single user-visible Run may consume up to ten provider requests and a large fraction of a provider's daily tokens.

## Provider comparison

| Option | Free allowance | Agent capabilities | Locus fit | Public-launch judgment |
| --- | --- | --- | --- | --- |
| **Cloudflare Workers AI** | 10,000 neurons/day, resetting at 00:00 UTC; requests fail after the allocation ([pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)) | Qwen 3.8 supports function calling, reasoning, 262K context, and `response_format` ([model page](https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/)) | Approximately one substantial Run/day. Cloudflare JSON mode can fail schema conformance, so validation/retry testing is required ([JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/)). | **Best recurring-free beta option**, with a global queue and hard cap. Not an unrestricted service. |
| **Cerebras direct** | Current commercial page describes a **$5 initial free trial**, while rate-limit docs show Free-tier limits of 64K TPM and 1M TPD for `gpt-oss-120b` ([pricing](https://www.cerebras.ai/pricing), [limits](https://inference-docs.cerebras.ai/support/rate-limits)) | GPT-OSS 120B is a production model with multi-turn tools and strict schema output ([models](https://inference-docs.cerebras.ai/models/overview), [tools](https://inference-docs.cerebras.ai/capabilities/tool-use), [structured outputs](https://inference-docs.cerebras.ai/capabilities/structured-outputs)) | The best technical match among no-upfront-cost options, but the current $5 offer is finite rather than a promised recurring allowance. | **Best short canary/trial path**, not durable zero-cost infrastructure. |
| **Groq Free** | No card required; `gpt-oss-120b` is limited to 30 RPM, 1,000 RPD, 8K TPM, and 200K TPD ([free-plan FAQ](https://community.groq.com/t/is-there-a-free-tier-and-what-are-its-limits/790), [limits](https://console.groq.com/docs/rate-limits)) | GPT-OSS 120B has 131K context, tool use, reasoning, and JSON schema mode ([model page](https://console.groq.com/docs/model/openai/gpt-oss-120b)). Tool use and structured output cannot be combined in one request, which is compatible with Locus's tool-free final step ([structured outputs](https://console.groq.com/docs/structured-outputs)). | The 8K TPM ceiling is far below the current full Run budget and is organization-wide. It would require smaller steps, pacing, and a strict global queue. | **Useful fallback or tiny demo**, not dependable public self-service. |
| **OpenRouter free models** | 50 free-model requests/day without purchasing $10 of credits; OpenRouter explicitly says free models are usually unsuitable for production ([FAQ](https://openrouter.ai/docs/faq)) | `openrouter/free` filters for requested tools and structured outputs, then randomly selects a compatible free model ([free router](https://openrouter.ai/docs/guides/routing/routers/free-router)). The live Models API currently lists several zero-price models supporting both capabilities ([Models API](https://openrouter.ai/api/v1/models)). | At ten requests per Run, the account-wide allowance is at most about five ideal Runs/day. Random model choice makes quality and reproducibility weaker. | **Emergency/demo fallback only.** |
| **Hugging Face Inference Providers** | Free users receive $0.10/month, subject to change; extra use requires purchased credits ([pricing](https://huggingface.co/docs/inference-providers/pricing)) | Function calling and structured outputs exist, but support is provider/model-specific ([function calling](https://huggingface.co/docs/inference-providers/guides/function-calling), [structured output](https://huggingface.co/docs/inference-providers/guides/structured-output)). | The allowance is too small for meaningful autonomous coding-agent traffic. | **Experimentation only.** |
| **Vercel AI Gateway system credentials** | Vercel documents $5 monthly credits for a free team ([pricing](https://vercel.com/docs/ai-gateway/pricing)). | Best fit with the existing AI SDK integration, model routing, privacy controls, and observability. | The current Locus production request was rejected because this team has no credit card on file. The advertised credit is therefore not presently usable as a zero-card path for this account. | **Use after billing verification**, not the immediate free-launch answer. |

GitHub Models is not an alternative: GitHub retired its playground, model catalog, inference API, and BYOK service on July 30, 2026 ([GitHub Models](https://docs.github.com/en/github-models)).

## Data-policy implications

- Cloudflare says it does not use Workers AI customer content for model training or service improvement without explicit consent and does not expose it to other customers ([Cloudflare data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/)).
- Cerebras says it does not retain inputs and outputs associated with its inference services ([Cerebras privacy](https://cloud.cerebras.ai/privacy)).
- Groq does not retain ordinary inference inputs or outputs by default, although temporary reliability or abuse logs may be kept for up to 30 days unless the customer enables the available zero-data-retention control ([Groq data policy](https://console.groq.com/docs/your-data)).
- OpenRouter prompt retention is opt-in and off by default, but the selected downstream provider's policy still applies; strict privacy filters may reduce free-model availability ([OpenRouter data collection](https://openrouter.ai/docs/guides/privacy/data-collection)).

Changing providers is therefore a reviewed product-policy change, not merely an environment-variable edit. The consent text, model allowlist, privacy documentation, error messages, and canary evidence must name the actual route.

## Recommended launch shape

1. Keep the landing page, workspace, localization, saved Slice, and guided demo publicly available on the existing free web stack.
2. Label live execution **“Limited free beta”**, not “unlimited” or “production capacity.”
3. Route the shared free pool to Cloudflare Qwen 3.8 behind a global one-substantial-Run/day quota, with one queued Run per verified user and a clear next-reset time.
4. Use Cerebras GPT-OSS 120B only for a short canary/evaluation while its finite trial credit remains. Do not build the public promise around that credit.
5. Add optional BYOK for users who want immediate or heavier execution. Accept only a reviewed provider/model pair; encrypt the key in transit, avoid logs and analytics, scope it to a single user or Run, and delete it when the user removes it. Direct provider calls avoid the current Gateway card gate.
6. Preserve the existing token, time, sandbox, verification, and human-Review boundaries. Add provider-specific quota telemetry and fail closed rather than silently changing models or data policy.
7. Run the same frozen canary against the chosen free route before advertising live Agent Runs. In particular, verify all ten tool-loop steps, final structured output, quota exhaustion, reset behavior, and privacy-safe logs.

## Bottom line

**Yes, Locus can launch for $0 as a transparent limited beta.** Cloudflare's recurring daily allocation is the strongest shared free pool; Cerebras is the strongest short technical trial; BYOK is the only credible route to broader self-serve usage without Locus paying inference costs.

**No current provider supports unlimited, reliable, fully self-serve public Agent Runs for free.** Presenting a low-quota provider as unrestricted would turn provider exhaustion into the core product experience and would not be launch-ready.
