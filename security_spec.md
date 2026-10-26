# CONEXA Security Specification

> **Status:** Esta é uma especificação histórica do modelo Firebase/Firestore. O runtime web atual usa Express + SQLite e não carrega estas regras. Os invariantes continuam sendo requisitos de segurança, mas só são comprovados onde há implementação e testes específicos nas rotas locais.

## 1. Data Invariants

1. **Self-Profile Ownership**: A user can only create or update their own profile document (`/users/{uid}` where `request.auth.uid == uid`).
2. **Anti-Escalation**: Users cannot self-assign privileged roles (`role: "ADMIN"` or `role: "SUPER_ADMIN"`) or unblock themselves (`isBlocked: false` if blocked by admin).
3. **PII Strict Isolation (Pillar 6)**: Email and blocked users list are stored in `/users/{uid}/private/account`, which is restricted exclusively to `request.auth.uid == uid` or verified admins. Public user searches only query `/users/{uid}`.
4. **Conversation Participant Isolation**: Only exact participants (`request.auth.uid in resource.data.participantIds`) can read or write to `/conversations/{conversationId}`.
5. **Deterministic 1:1 Constraints**: A conversation must have exactly 2 distinct participant IDs, with the creator being one of them.
6. **Message Authenticity**: Only a participant can post messages, and `incoming().senderId` must strictly equal `request.auth.uid`.
7. **Message Reader Isolation**: Messages can only be read by participants of the parent conversation.
8. **Message State Transition Guard**: Only the recipient can transition message status to `DELIVERED` or `READ`. The sender cannot mark their own messages as `READ`.
9. **Volumetric & Schema Guard**: Messages cannot exceed 4000 characters. No ghost or shadow fields are permitted (`hasOnly` validation).
10. **Report Integrity**: Authenticated users can submit reports, but `incoming().reporterId` must match `request.auth.uid`.
11. **Admin Exclusivity**: `/reports` and `/admins` collections can only be listed and managed by authorized administrators (`isAdmin()`).
12. **Bootstrapped Admin Trust**: Admin verification relies on verified email `kalebisantosdecastro0@gmail.com` or trusted existence in `/admins/{uid}`.

---

## 2. The "Dirty Dozen" Malicious Payloads

1. **Payload 1 (Privilege Escalation)**: User sets `role: "ADMIN"` during profile update.

```json
{
  "path": "/users/victim123",
  "operation": "update",
  "auth": { "uid": "victim123" },
  "data": { "role": "ADMIN" }
}
```

_Expected: PERMISSION_DENIED_

2. **Payload 2 (IDOR Profile Hijack)**: Attacker attempts to overwrite Victim's profile.

```json
{
  "path": "/users/victim123",
  "operation": "update",
  "auth": { "uid": "attacker456" },
  "data": { "displayName": "Pawned" }
}
```

_Expected: PERMISSION_DENIED_

3. **Payload 3 (PII Snoop)**: Attacker attempts to read victim's private email document.

```json
{
  "path": "/users/victim123/private/account",
  "operation": "get",
  "auth": { "uid": "attacker456" }
}
```

_Expected: PERMISSION_DENIED_

4. **Payload 4 (Third-Party Conversation Eavesdropping)**: User C attempts to read User A & B's conversation.

```json
{
  "path": "/conversations/userA_userB",
  "operation": "get",
  "auth": { "uid": "userC" }
}
```

_Expected: PERMISSION_DENIED_

5. **Payload 5 (Message Sender Impersonation)**: Attacker attempts to send message with `senderId: "victim123"`.

```json
{
  "path": "/conversations/userA_userB/messages/msg999",
  "operation": "create",
  "auth": { "uid": "attacker456" },
  "data": {
    "messageId": "msg999",
    "conversationId": "userA_userB",
    "senderId": "victim123",
    "receiverId": "userB",
    "type": "TEXT",
    "text": "Fraudulent message",
    "status": "SENT",
    "deleted": false
  }
}
```

_Expected: PERMISSION_DENIED_

6. **Payload 6 (Message Status Forgery by Sender)**: Sender attempts to mark their own message as `READ`.

```json
{
  "path": "/conversations/userA_userB/messages/msg1",
  "operation": "update",
  "auth": { "uid": "userA" },
  "data": { "status": "READ" }
}
```

_Expected: PERMISSION_DENIED_

7. **Payload 7 (Denial of Wallet - Message Overflow)**: Attacker sends 50,000 characters string.

```json
{
  "path": "/conversations/userA_userB/messages/msg2",
  "operation": "create",
  "auth": { "uid": "userA" },
  "data": {
    "text": "A".repeat(50000)
  }
}
```

_Expected: PERMISSION_DENIED_

8. **Payload 8 (Shadow Fields Injection)**: Injecting undeclared malicious keys.

```json
{
  "path": "/conversations/userA_userB/messages/msg3",
  "operation": "create",
  "auth": { "uid": "userA" },
  "data": {
    "text": "Normal text",
    "__proto__": { "polluted": true },
    "systemCommand": "DROP TABLE"
  }
}
```

_Expected: PERMISSION_DENIED_

9. **Payload 9 (ID Poisoning Attack)**: Document ID containing path traversal or illegal symbols.

```json
{
  "path": "/conversations/../../root",
  "operation": "create",
  "auth": { "uid": "userA" }
}
```

_Expected: PERMISSION_DENIED_

10. **Payload 10 (Spoofed Abuse Report)**: Attacker files a report posing as victim.

```json
{
  "path": "/reports/rep101",
  "operation": "create",
  "auth": { "uid": "attacker456" },
  "data": {
    "reportId": "rep101",
    "reporterId": "victim123",
    "reportedUserId": "innocentUser",
    "reason": "SPAM",
    "status": "OPEN"
  }
}
```

_Expected: PERMISSION_DENIED_

11. **Payload 11 (Report Snooping by Non-Admin)**: Standard user attempts to list moderation queue.

```json
{
  "path": "/reports",
  "operation": "list",
  "auth": { "uid": "userA" }
}
```

_Expected: PERMISSION_DENIED_

12. **Payload 12 (Self-Appointment as Admin)**: Standard user attempts to insert themselves into `/admins`.

```json
{
  "path": "/admins/attacker456",
  "operation": "create",
  "auth": { "uid": "attacker456" },
  "data": {
    "uid": "attacker456",
    "role": "SUPER_ADMIN"
  }
}
```

_Expected: PERMISSION_DENIED_
