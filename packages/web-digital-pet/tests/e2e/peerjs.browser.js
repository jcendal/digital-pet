// Browser transport double: the test runner delivers ordered events between isolated contexts.
const peers = new Map()
const connections = new Map()
class Events {
  listeners = new Map()
  on(event, listener) {
    const group = this.listeners.get(event) ?? []
    group.push(listener)
    this.listeners.set(event, group)
  }
  emit(event, value) {
    for (const listener of this.listeners.get(event) ?? []) listener(value)
  }
}
class Connection extends Events {
  constructor(peer, connectionId) {
    super()
    this.peer = peer
    this.connectionId = connectionId
    this.closed = false
    connections.set(connectionId, this)
  }
  send(data) {
    if (!this.closed) void window.testPeerSend({ type: "data", connectionId: this.connectionId, data })
  }
  close() {
    if (this.closed) return
    this.closed = true
    this.emit("close")
    void window.testPeerSend({ type: "close", connectionId: this.connectionId })
  }
}
window.testPeerEvent = (event) => {
  if (event.type === "incoming") {
    peers.get(event.target)?.emit("connection", new Connection(event.peer, event.connectionId))
    connections.get(event.connectionId)?.emit("open")
  } else {
    const connection = connections.get(event.connectionId)
    if (event.type === "close" && connection) connection.closed = true
    connection?.emit(event.type, event.data)
  }
}
export default class Peer extends Events {
  constructor(id) {
    super()
    this.id = id
    this.open = false
    peers.set(id, this)
    void window.testPeerSend({ type: "register", id }).then(() => {
      this.open = true
      this.emit("open", id)
    })
  }
  connect(target) {
    const connection = new Connection(target, crypto.randomUUID())
    window.setTimeout(() => {
      void window
        .testPeerSend({ type: "connect", target, peer: this.id, connectionId: connection.connectionId })
        .then(() => connection.emit("open"))
    }, 0)
    return connection
  }
  destroy() {
    this.open = false
    peers.delete(this.id)
  }
}
