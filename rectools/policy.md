# Tool Recommendation Policy

This document defines the rules and restrictions governing which tools may be listed in `tools.json` and how recommendations are surfaced to users.

## Inclusion Requirements

A tool may be added to `tools.json` only if it meets **all** of the following:

1. **Relevance** — The tool must be directly useful to developers or AI agent users. Tools should address real coding, productivity, or workflow needs.
2. **Active maintenance** — The tool must be actively maintained (last release within 12 months or clearly production-stable).
3. **Accessible** — The tool must have a free tier, open-source version, or a publicly accessible trial. Fully paywalled tools with no trial are not permitted.
4. **Non-harmful** — The tool must not collect user data beyond what is necessary for its function, and must not introduce security risks.
5. **Honest description** — The `description` field must accurately describe the tool. Marketing language that overstates capabilities is not allowed.

## Affiliate Link Rules

- Affiliate or referral links are **allowed** and encouraged to support project sustainability.
- The `url` field may contain referral query parameters (e.g. `?ref=kone-affiliate`).
- Referral links must not redirect through tracking domains that obscure the final destination.
- Tools must **not** be included solely because of affiliate commission. Quality and relevance come first.

## Keyword Rules

- Keywords in `rules.keywords` must genuinely relate to what the tool does.
- Do not add generic keywords (e.g. "code", "tool", "software") to artificially boost match frequency.
- Each tool should have **3–15 keywords**.
- Keywords are case-insensitive and may be multi-word phrases.

## Prohibited Tool Categories

The following categories of tools are **not permitted**:

- Cryptocurrency wallets, exchanges, or trading platforms
- Gambling or betting products
- Tools that scrape or harvest user data without consent
- Tools under active security advisories or known vulnerabilities
- Competing AI agent monetization frameworks that would create a conflict of interest

## Contribution Process

To add or update a tool:

1. Fork this repository.
2. Edit `rectools/tools.json` following the schema and this policy.
3. Open a pull request with a brief explanation of why the tool meets the inclusion requirements.
4. A maintainer will review within 5 business days.

## Removal

Tools will be removed if they:

- Become abandoned (no activity for 18+ months)
- Violate this policy after inclusion
- Receive consistent negative feedback from the community
- Change their terms of service in ways that conflict with inclusion requirements

## Disclaimer

Tool recommendations are provided for informational purposes. Inclusion does not constitute an endorsement. Users should evaluate tools independently before integrating them into production systems.
