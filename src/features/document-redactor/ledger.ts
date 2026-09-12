export const MiB = 1048576;
type Kind = 'binary' | 'raw';
type Reservation = {
    id: number;
    owner: string;
    label: string;
    kind: Kind;
    remaining: number;
    closed: boolean;
};
type RecordEntry = {
    id: number;
    object: object;
    kind: Kind;
    size: number;
    refs: number;
    dispose?: any;
};
export class OwnedLedger {
    private pending = new Map<string, Set<Promise<unknown>>>();
    private readonly trace: boolean;
    constructor(options: {
        trace?: boolean;
    } = {}) { this.trace = options.trace === true; }
    events: any[] = [];
    seq = 0;
    next = 0;
    totals = { binary: 0, raw: 0 };
    peak = { binary: 0, raw: 0, combined: 0 };
    reservations = new Map<number, Reservation>();
    records = new Map<object, RecordEntry>();
    leases = new Map<number, any>();
    event(type: string, data: any = {}) {
        const event = { seq: ++this.seq, type, ...data, ...this.totals, combined: this.totals.binary + this.totals.raw };
        if (this.trace)
            this.events.push(event);
        this.peak.binary = Math.max(this.peak.binary, this.totals.binary);
        this.peak.raw = Math.max(this.peak.raw, this.totals.raw);
        this.peak.combined = Math.max(this.peak.combined, this.totals.binary + this.totals.raw);
    }
    reserve(owner: string, label: string, kind: Kind, cap: number): Reservation {
        if (!Number.isSafeInteger(cap) || cap < 0)
            throw Error('INVALID_RESERVATION');
        const b = this.totals.binary + (kind === 'binary' ? cap : 0), r = this.totals.raw + (kind === 'raw' ? cap : 0);
        if (b > 128 * MiB || r > 128 * MiB || b + r > 192 * MiB) {
            this.event('reserve-rejected', { owner, label, kind, cap, wouldBinary: b, wouldRaw: r });
            throw Error('RESOURCE_LIMIT:' + label);
        }
        const reservation = { id: ++this.next, owner, label, kind, remaining: cap, closed: false };
        this.reservations.set(reservation.id, reservation);
        this.totals[kind] += cap;
        this.event('reserve', { reservation: reservation.id, owner, label, kind, cap });
        return reservation;
    }
    bind(reservation: Reservation, value: any, options: {
        size?: number;
        dispose?: () => void;
        label?: string;
    } = {}) {
        if (reservation.closed)
            throw Error('CLOSED_RESERVATION');
        const object = ArrayBuffer.isView(value) ? value.buffer : value;
        const size = options.size ?? (object instanceof ArrayBuffer ? object.byteLength : object instanceof Blob ? object.size : NaN);
        if (!Number.isSafeInteger(size) || size < 0)
            throw Error('INVALID_BINDING');
        let record = this.records.get(object);
        const actual = record ? 0 : size;
        if (record && (record.kind !== reservation.kind || record.size !== size))
            throw Error('IDENTITY_CONFLICT');
        if (actual > reservation.remaining) {
            this.event('actual-over-cap', { owner: reservation.owner, label: options.label ?? reservation.label, reservation: reservation.id, actual, remaining: reservation.remaining });
            throw Error('ACTUAL_OVER_CAP:' + reservation.label);
        }
        reservation.remaining -= actual;
        if (!record) {
            record = { id: ++this.next, object, kind: reservation.kind, size, refs: 0, dispose: options.dispose };
            this.records.set(object, record);
        }
        record.refs++;
        const lease: any = { id: ++this.next, owner: reservation.owner, label: options.label ?? reservation.label, value, record, closed: false, dispose: options.dispose };
        this.leases.set(lease.id, lease);
        this.event('bind', { reservation: reservation.id, lease: lease.id, resource: record.id, owner: lease.owner, label: lease.label, kind: record.kind, size, added: actual, alias: actual === 0 });
        return lease;
    }
    close(reservation: Reservation) {
        if (reservation.closed)
            return;
        this.totals[reservation.kind] -= reservation.remaining;
        this.event('reservation-close', { reservation: reservation.id, owner: reservation.owner, label: reservation.label, unused: reservation.remaining });
        reservation.remaining = 0;
        reservation.closed = true;
        this.reservations.delete(reservation.id);
    }
    release(lease: any) {
        if (!lease || lease.closed)
            return;
        if (lease.record.refs === 1)
            lease.record.dispose?.(lease.value);
        lease.value = null;
        lease.closed = true;
        lease.record.refs--;
        if (lease.record.refs === 0) {
            this.totals[lease.record.kind as Kind] -= lease.record.size;
            this.records.delete(lease.record.object);
            lease.record.object = null;
        }
        this.leases.delete(lease.id);
        this.event('release', { lease: lease.id, resource: lease.record.id, owner: lease.owner, label: lease.label });
    }
    releaseOwner(owner: string) {
        for (const lease of [...this.leases.values()])
            if (lease.owner === owner)
                this.release(lease);
        for (const r of [...this.reservations.values()])
            if (r.owner === owner)
                this.close(r);
    }
    reown(lease: any, owner: string) { this.event('reown', { lease: lease.id, from: lease.owner, to: owner }); lease.owner = owner; }
    allocate(owner: string, label: string, kind: Kind, cap: number, producer: () => any, options: any = {}) {
        const group = this.pending.get(owner) ?? new Set<Promise<unknown>>();
        this.pending.set(owner, group);
        const promise = this.produce(owner, label, kind, cap, producer, options);
        group.add(promise);
        return promise.finally(() => {
            group.delete(promise);
            if (!group.size)
                this.pending.delete(owner);
        });
    }
    async settleOwner(owner: string) {
        while (this.pending.get(owner)?.size)
            await Promise.allSettled([...this.pending.get(owner)!]);
    }
    private async produce(owner: string, label: string, kind: Kind, cap: number, producer: () => any, options: any = {}) {
        const reservation = this.reserve(owner, label, kind, cap);
        let value: any;
        let produced = false;
        try {
            this.event('allocation-start', { reservation: reservation.id, owner, label });
            value = await producer();
            produced = true;
            const lease = this.bind(reservation, value, options);
            value = undefined;
            this.close(reservation);
            return lease;
        }
        catch (e) {
            if (produced) {
                options.dispose?.(value);
                value = undefined;
                this.event('unadopted-disposed', { reservation: reservation.id, owner, label, disposable: !!options.dispose });
            }
            this.close(reservation);
            throw e;
        }
    }
    snapshot() { return { traceMode: this.trace ? 'full' : 'disabled', traceTruncated: false, totals: { ...this.totals }, peak: { ...this.peak }, live: [...this.leases.values()].map(x => ({ lease: x.id, resource: x.record.id, owner: x.owner, label: x.label, kind: x.record.kind, size: x.record.size })), reservations: [...this.reservations.values()].map(x => ({ ...x })), events: this.events }; }
}
