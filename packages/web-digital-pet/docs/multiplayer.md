# Browser multiplayer

Combat is a full-screen shell view with Arena, Friends and Activity tabs. Profile
is under More. Both social peers must select the browser save and choose an alias.
The public static app selects the browser automatically; the local computer host
can also display a separate SQLite companion.

## Identity and routing

The social feature reuses the existing `device-code` in the `web-digital-pet`
IndexedDB database. It does not rotate it when an alias changes, a companion is
replaced or a pet backup is imported. The alias is display metadata, may repeat
and can be edited. Friend records use normalized 16-character codes. The active
companion's catalog ID is the thumbnail; disconnected contacts retain the last
received profile.

This identity belongs to one browser profile and origin. Clearing site data or
using another browser/device does not recover the same friends. Pet backups and
own-device pairing do not include the social identity or social inbox.

Invitation URLs use `/#invite?code=<code>&alias=<label>`. Opening a URL validates
its code and shows a confirmation. It never sends a request automatically. The
label is unverified until the peer responds. First-use alias selection preserves
the invitation target until the user returns to the confirmation.

## Storage and transport

- `social:v1`: profile, friends, incoming/outgoing receipts, exchange journal,
  daily gift limits and a bounded display log, updated in one IndexedDB transaction.
- `social:trade-lock`: persistent lock on local game mutations while an exchange
  is prepared or committed. Pet advancement and adventure updates also respect it.
- Peer endpoint: `web-digital-pet-social-v1-<device-code>`. This is deliberately
  separate from own-device save transfer and temporary six-digit battle endpoints.
- One endpoint owner per origin uses a Web Lock. A second tab displays an
  explanatory state and can take ownership after the first tab closes. A signaling
  identity conflict preserves the existing code and reports the conflict.
- Each channel validates a versioned profile before accepting messages, derives
  the counterpart's code from its endpoint and bounds message size and pending
  receipt count. Presence uses a live channel with heartbeat expiry.

There is no global alias directory, account authentication or cloud mailbox.
The peer code is a public address, not proof of a real-world identity. Gifts,
challenges and proposals require an accepted friend connection. Adding a friend
never authorizes save import or own-device synchronization.

## Friendship and gifts

A receiving peer persists a request before acknowledging delivery. The sender's
Activity distinguishes connecting, not delivered and awaiting acceptance. Retry
keeps the original receipt ID. Cancelling queues a withdrawal; late acceptance
cannot recreate a cancelled request. Acceptance can be stored locally while the
other player is disconnected, then acknowledged on reconnection.

A connection failure does not establish that a code is invalid or does not exist.
Both applications must be open to deliver an item. Received items stay available
locally after the sender disconnects. There is no delivery to a closed browser.

The initial gift is one food ration per friend per UTC calendar day. The limit is
client-enforced, with a persistent receipt and send allowance; it is not a
server-authoritative economy. Retrying the same receipt cannot award another
ration. Collection leaves a gift pending if it would overwrite available food or
if the companion cannot currently receive it. Normal feeding supplies experience.

Friend challenges carry the current six-digit battle code and use the existing
battle negotiation, deterministic outcome, checkpointing and reward receipt.

## Arena selection

Arena has its own fighter selector. It stores the partner ID as `arena-partner`
in the local `pet` store without swapping the principal and reserve slots. Team
continues to select the companion receiving normal care. Profile and Friends
thumbnails continue to show that active companion. The optional `arenaNodeId`
profile field advertises the separate fighter for challenge previews; older
peers without this field fall back to the active thumbnail.

The selection follows partner identity across team swaps and reloads. If that
partner leaves the team, Arena falls back to the principal. Eggs and occupied
partners cannot be selected. The existing battle and exchange locks still apply.
Battle negotiation snapshots the selected fighter and rewards only its saved
identity. A reserve fighter keeps its passive clock paused. Experience reaching
an evolution threshold is retained, with evolution queued on normal activation
in Team so that a resting evolution cannot prevent switching companions.

## Exchange settlement before playback

Exchanges swap one Digimon for another. Eggs, occupied companions, stale team
snapshots and pending evolutions are ineligible. Offers are immutable; changing a
selection requires cancelling and creating another proposal.

1. The initiator sends an offer with a validated individual companion snapshot.
2. The receiver chooses its companion and confirms. Preparation, the local game
   lock and its outgoing ready receipt are written atomically.
3. The initiator reviews both snapshots and confirms. A durable coordinator
   journal records preparation, then the local swap is committed exactly once.
4. The coordinator retries the commit until the receiver has applied its own
   local transaction and acknowledges it. A lost acknowledgement can be replayed.
5. The coordinator marks resolution and sends completion. Each browser releases
   its lock after resolution and presents the saved result locally.

Prepared/committed journals resume after reload. The coordinator's prepared
journal already records explicit user confirmation and can complete its local
commit on recovery. A receiver's prepared journal contains the ready receipt even
if the browser closes immediately after preparation. Before the coordinator commits, a prepared receiver can request cancellation.
The coordinator durably decides whether to abort or finish a commit already made,
and a lost abort response is retried from the saved request. Cancelled proposals
cannot subsequently be confirmed. Once committed, cancellation cannot undo just
one side. An old cancellation cannot release a newer exchange's
lock.

The animation starts only after settlement evidence has been received and stored.
It runs locally for 4.8 seconds, or 0.6 seconds with reduced motion. One scene clock
gathers the catalog sprite pixels, crosses them once, rebuilds the received
companion and ends on its happy pose. The clock pauses in background tabs and the
action area keeps the dialog dimensions stable. The result
survives a reload during playback; playback never imports another Digimon. The
sender's journey is archived at transfer and the recipient starts a new journey
at the received stage, preserving experience and care. Trainer unlocks, historical
journeys and the other team slot remain local.

Independent browsers cannot offer server-authoritative atomic ownership or force
completion if a peer permanently disappears during settlement. An interrupted
exchange remains recoverable and explicitly pending instead of silently rolling
back one side or claiming success without matching evidence.

## Verification

`social.spec.ts` connects two isolated browser saves through the PeerJS test
adapter while exercising the real controllers, protocol validation, IndexedDB
transactions, UI and animation. It covers invitation confirmation, friendship,
alias updates, daily gifts, an interrupted commit, reload recovery, exactly-once
history changes and playback after peer traffic stops. It does not measure real
Internet NAT traversal or signaling uptime.

`social-storage.spec.ts` additionally covers concurrent identity reads, durable
preparation, cross-view locks, scope validation, receipt deduplication, withdrawals
and late acceptance. Domain tests cover both team slots, journey boundaries,
malformed payloads, stale snapshots and reduced-motion timing.

`arena.spec.ts` verifies independent selection, reload persistence, the unchanged
Profile companion and an actual negotiated battle using the reserve fighter.
Arena domain tests cover reward routing, stale identities, paused reserve clocks
and evolution after activation.
