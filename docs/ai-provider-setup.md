# AcidMade AI Provider Setup

The Acid AI panel connects an AI provider and uses the active scene context to answer questions and stage scene changes.

## Providers

AcidMade supports three provider shapes:

- **OpenAI / compatible** — any `/chat/completions` endpoint.
- **Anthropic** — native Messages API.
- **Ollama** — local runtime, no key required.

### Provider config

Each provider has:

- a base URL,
- a default model,
- a key requirement flag,
- a list of example models.

The provider card in the panel lets you switch provider, set the base URL, pick a model, and enter a key for providers that require one.

### Provider behavior

- OpenAI-compatible providers are called through `/chat/completions`. If the base URL does not already end with `/chat/completions`, the runtime appends it.
- Anthropic is called through `/messages`. If the base URL ends with `/v1`, the runtime appends `/messages`. Otherwise it appends `/v1/messages`.
- Ollama is called through `/api/chat`. If the base URL does not already end with `/api/chat`, the runtime appends it.

## Connecting a provider

1. Open the Acid AI panel.
2. Choose a provider.
3. For OpenAI or Anthropic, paste the API key.
4. Confirm the base URL and model.
5. Click **Connect provider** or **Apply provider**.

When connected, the provider card shows "connected" and the panel enables chat.

## BYOK behavior

AcidMade is bring-your-own-key.

- The key is sent only to the local AcidMade runtime.
- The runtime proxies the provider call.
- The key is held in memory for the session.
- The key is not written to disk or localStorage.
- The workspace snapshot does not store keys.
- You can click **forget key** to clear the in-memory key.

## Attachments

The panel supports attachments in chat messages.

- Up to four attachments per message.
- Images up to 2 MB each, sent as base64 data URLs.
- Text-like files up to 512 KB each, read and included as text.
- Supported text extensions include `txt`, `md`, `ts`, `tsx`, `js`, `jsx`, `json`, `css`, `html`, `py`, `yml`, `yaml`, `toml`, `sh`.

Unsupported file types are rejected with a clear message.

## Scene context

The provider prompt includes:

- Project name, slug, and branch.
- Selected node: name, class, kind, id.
- Active resource path.
- Open diagnostics, trimmed to the first five.
- Recent engine log lines.
- Active scene tree, id/name/class/kind/parent, trimmed.
- Available classes.
- Editable keys by kind.
- Selected node effective configuration.

The context is trimmed to keep the prompt bounded.

## Staged scene actions

The provider can propose exactly one scene change at a time.

### Action types

- **create** — create a node under an existing parent, with name, class, and kind.
- **rename** — rename an existing node.
- **configure** — change one or more properties on an existing node.

### How staging works

1. The provider returns an action in its JSON response.
2. The editor validates the action against the live tree.
3. If valid, the editor stages the change and shows a confirmation card.
4. The operator confirms or discards.
5. Nothing touches the scene until the operator confirms.

If the action is invalid, the editor shows the reason and does not stage it.

### Confirmation card

The confirmation card shows:

- The action summary and description.
- Facts about the targeted node or parent.
- The property changes, with before/after values.
- Discard and Apply change buttons.

The send button is disabled while a change is staged.

## Response format

The provider response is parsed from JSON. The parser looks for:

- a JSON object anywhere in the response,
- a JSON block in markdown fences,
- a JSON object from the first `{` to the last `}`.

The parsed response must include a message or reply text, and optionally one action.

If the provider returns plain text, the editor uses it as the message and does not stage an action.

## Timeout and limits

- Provider requests time out after 90 seconds by default on the runtime side, and the client enforces a 100-second client timeout.
- Messages are trimmed to a bounded length.
- Images are limited to four per message.
- Actions are limited to one per response.

## Troubleshooting

### "Connect an agent provider before sending a message."

Connect a provider first. For Ollama, no key is needed; for OpenAI or Anthropic, paste a key.

### "Base URL must start with http:// or https://"

The base URL must be a valid HTTP or HTTPS URL.

### "Scene change not staged"

The action did not match the live tree. Check that the node id, parent id, class name, and property keys are valid for the current scene.

### Provider error

If the provider returns a non-200 response, the editor shows the error message. Check the base URL, key, and model.

## Security notes

- Never paste a provider key into a file, commit it, or send it to the editor client directly.
- The runtime is the only component that holds the key during a session.
- If you share the project, remove any keys from the runtime environment before pushing.
