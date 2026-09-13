# Security Policy

The Agent Interaction Kit (AIK) project takes the security of our library, CLI, and downstream users seriously.

---

## Reporting a Vulnerability

If you discover a security vulnerability or suspect a security flaw in Agent Interaction Kit, **do not disclose it publicly in an issue, discussion, pull request, or social media.**

Please report vulnerabilities privately via **GitHub Security Advisories**:

👉 **[Submit a Security Advisory](https://github.com/DevJoaoLopes/agent-interaction-kit/security/advisories/new)**

### What to Include

To help us triage and investigate the issue efficiently, please include:

- The affected version of `@agent-interaction-kit/core` or related tooling.
- A clear description of the vulnerability and its potential impact.
- Minimal, reproducible steps or CLI commands demonstrating the behavior.
- Sanitized manifest examples (`aik.provider.json` / `aik.consumer.json`) with all proprietary, confidential, or private application data removed.
- Any suggested remediations or mitigations, if known.

---

## Supported Versions & Policy

| Version | Supported | Notes |
| :--- | :---: | :--- |
| `0.x` (Beta) | Experimental | Pre-1.0 releases are experimental; fixes are released in upcoming versions. |
| `>= 1.0.0` | Latest Stable | Once 1.0 is released, security fixes will target the latest stable release. |
| `< 1.0.0` | Best-effort | Older minor/patch versions will not receive backported security patches. |

### Maintenance Model

Agent Interaction Kit is maintained on an open-source, **best-effort basis**. We do not provide commercial service-level agreements (SLAs) or guaranteed response/remediation timelines. We appreciate your patience and responsible disclosure as we work to investigate and resolve reported issues.
