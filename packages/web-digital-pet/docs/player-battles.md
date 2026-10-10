# Player battles: PeerJS and authority

## Decision

Use the existing PeerJS Cloud signaling service and a separate reliable JSON
WebRTC connection for casual browser battles. No AWS deployment is needed to
make honest clients calculate the same result. PeerServer brokers connections;
it does not execute game rules or keep battle results. This follows the documented
[PeerJS data connection model](https://peerjs.com/client/getting-started).

The six-digit code is a temporary connection address, not an account or credential.
PeerJS rejects an already registered ID; the client retries another random code.
An incoming connection requires explicit battle acceptance and never transfers a
save. Both players need to be online with their browser save selected. Networks
that block WebRTC may still require TURN; a Lambda does not replace a TURN relay.
See the [PeerJS networking FAQ](https://peerjs.com/client/faq).

## Protocol v1

1. Challenger sends a UUID battle ID, partner/node identity and SHA-256 commitment
   to a cryptographically generated 256-bit secret. Commitment includes protocol
   version, battle ID, participant role and fighter identity.
2. Receiver explicitly accepts with its own fighter and commitment. Stats are
   always looked up in the local shared catalogue, never accepted from a message.
3. Challenger reveals its secret; receiver verifies it, then reveals its own.
   Neither participant can choose new randomness after seeing the other's secret.
4. Both hash the canonical participant order and secrets into a seed, use the
   shared deterministic combat planner, and exchange a digest covering the
   participants, battle ID, all shots and outcome. A mismatch aborts.
5. Each client starts only after validating the other's digest. Receiver mirrors
   the canonical plan for local playback without rerolling any attacks. Winner
   earns 20% of its selected current stage threshold, capped at that threshold;
   final stages receive no XP. Normal evolution remains a separate presentation.
6. The seed, fighters, complete plan, accepted reward target and local agreement
   receipt are saved before playback, without changing XP. Every completed attack
   checkpoints progress. Returning to the viewer or reloading resumes locally,
   even offline, without negotiating or rolling again. After the full outcome
   animation, one IndexedDB transaction awards XP, records completion and clears
   the pending entry. Repeated messages cannot award a second prize. Partner
   identity, node and selected experience setting must still match the accepted
   snapshot. Legacy pending battles that already received their prize never earn
   it again.

Requests expire after two minutes. Unknown participants, eggs, malformed messages,
wrong battle IDs, out-of-order messages, invalid reveals and mismatched plans are
rejected. Local presentation locks prevent simultaneous battles/feeding/evolution
in cooperating tabs. Browser options prevent transfers, imports, resets and
difficulty edits during the local battle; snapshot checks cover stale saves.

## Limits

This is a casual protocol between cooperating clients, not an anti-cheat system.
There are no server-owned accounts or verified save histories. A modified client
can lie about owning a catalogue Digimon, edit its local XP, clear receipts,
farm rewards with another browser or withhold its reveal after predicting a loss.
Commitments prevent changing a revealed secret but cannot force a peer to reveal.

Two independent browsers cannot make a durable atomic commit through a lossy
connection. If a final digest is delivered in only one direction, one player may
save agreement while the other times out. No inconsistent plan is accepted, but
confirmation on both peers is not guaranteed across crashes or disconnects. Once a browser has saved agreement, its playback and reward survive reloads locally. An unconfirmed negotiation is not a resumable battle.
Receipts are device-local and are deliberately separate from transferable saves.

## When to add AWS

For competitive rewards, rankings, shared recovery of unconfirmed results or reliable penalties for
abandonment, use an authoritative service. A small design would be:

- One Lambda with a Function URL or HTTP API; endpoints create a battle, accept
  it and retrieve its saved result. PeerJS can still handle invitations/playback.
- One DynamoDB table storing authenticated participants, immutable accepted
  snapshots, state, random seed, result and per-player reward receipts.
- Server uses the same core planner with server-generated randomness and writes
  the result once. Conditional writes prevent double acceptance/rewards and
  clients recover by querying the battle ID after reconnecting.
- Server verifies participant identity and ownership, and becomes authoritative
  for rewarded progression. Simply signing results while trusting editable
  browser saves would not make the economy cheat-resistant.

Lambda supports [Function URL authentication](https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html)
with IAM or a public endpoint with application-owned authentication. DynamoDB
[conditional writes](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html)
provide the create-once primitive. This is a proposed upgrade, not deployed
infrastructure. No pricing claim or AWS credentials are required for the current
PeerJS implementation.
