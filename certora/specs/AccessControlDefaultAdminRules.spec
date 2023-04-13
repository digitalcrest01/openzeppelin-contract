import "helpers.spec"
import "methods/IAccessControlDefaultAdminRules.spec"
import "methods/IAccessControl.spec"
import "AccessControl.spec"

use rule onlyGrantCanGrant filtered {
  f -> f.selector != acceptDefaultAdminTransfer().selector
}

// use rule revokeRoleEffect filtered {
//   role -> role != DEFAULT_ADMIN_ROLE()
// }

// use rule renounceRoleEffect filtered {
//   role -> role != DEFAULT_ADMIN_ROLE()
// }

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Helpers                                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

function max_uint48() returns mathint {
    return (1 << 48) - 1;
}

// defaultAdmin() returns the zero address when there's no default admin
function nonZeroAccount(address account) returns bool {
  return account != 0;
}

function timeSanity(env e) returns bool {
  return
    e.block.timestamp > 0 && // Avoids 0 schedules
    e.block.timestamp + defaultAdminDelay(e) < max_uint48();
}

function delayChangeWaitSanity(env e, uint48 newDelay) returns bool {
  return e.block.timestamp + delayChangeWait(e, newDelay) < max_uint48();
}

function isSet(uint48 schedule) returns bool {
  return schedule != 0;
}

function hasPassed(env e, uint48 schedule) returns bool {
  return schedule < e.block.timestamp;
}

function min(uint48 a, uint48 b) returns uint48 {
  return a < b ? a : b;
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Invariant: defaultAdmin holds the DEFAULT_ADMIN_ROLE                                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
invariant defaultAdminConsistency(address account)
  defaultAdmin() == account <=> hasRole(DEFAULT_ADMIN_ROLE(), account) 
  { preserved { require nonZeroAccount(account); } }

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Invariant: Only one account holds the DEFAULT_ADMIN_ROLE                                                            │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
invariant singleDefaultAdmin(address account, address another)
  hasRole(DEFAULT_ADMIN_ROLE(), account) && hasRole(DEFAULT_ADMIN_ROLE(), another) => another == account
  filtered { f -> f.selector != acceptDefaultAdminTransfer().selector }

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Invariant: DEFAULT_ADMIN_ROLE's admin is always the zero address                                                    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
invariant defaultAdminRoleAdminConsistency()
  getRoleAdmin(DEFAULT_ADMIN_ROLE()) == 0

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Invariant: owner is the defaultAdmin                                                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
invariant ownerConsistency()
  defaultAdmin() == owner()

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Rule: defaultAdmin is only affected by accepting an admin transfer or renoucing                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule noDefaultAdminChange(env e, method f, calldataarg args) {
  require nonZeroAccount(e.msg.sender);
  requireInvariant defaultAdminConsistency(defaultAdmin());
  requireInvariant singleDefaultAdmin(e.msg.sender, defaultAdmin());
  
  address adminBefore = defaultAdmin();
  f@withrevert(e, args);
  address adminAfter = defaultAdmin();

  assert adminBefore != adminAfter => (
    (f.selector == acceptDefaultAdminTransfer().selector && adminAfter != 0) ||
    (f.selector == renounceRole(bytes32,address).selector && adminAfter == 0)
  ), "default admin is only affected by accepting an admin transfer or renoucing";
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Rule: pendingDefaultAdmin is only affected by beginning, accepting or cancelling an admin transfer                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule noPendingDefaultAdminChange(env e, method f, calldataarg args) {
  requireInvariant defaultAdminConsistency(defaultAdmin());
  requireInvariant singleDefaultAdmin(e.msg.sender, defaultAdmin());

  address pendingAdminBefore = _pendingDefaultAdmin(e);
  address scheduleBefore = _pendingDefaultAdminSchedule(e);
  f@withrevert(e, args);
  address pendingAdminAfter = _pendingDefaultAdmin(e);
  address scheduleAfter = _pendingDefaultAdminSchedule(e);

  assert (
    pendingAdminBefore != pendingAdminAfter ||
    scheduleBefore != scheduleAfter
  ) => (
    f.selector == beginDefaultAdminTransfer(address).selector ||
    (f.selector == acceptDefaultAdminTransfer().selector && pendingAdminAfter == 0 && scheduleAfter == 0) ||
    (f.selector == cancelDefaultAdminTransfer().selector && pendingAdminAfter == 0 && scheduleAfter == 0)
  ), "pending admin and its schedule is only affected by beginning, accepting or cancelling an admin transfer";
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Rule: defaultAdminDelay can't be changed atomically by any function                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule noDefaultAdminDelayChange(env e, method f, calldataarg args) {
  uint48 delayBefore = defaultAdminDelay(e);
  f@withrevert(e, args);
  uint48 delayAfter = defaultAdminDelay(e);

  assert delayBefore == delayAfter, "delay can't be changed atomically by any function";
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Rule: pendingDefaultAdminDelay is only affected by changeDefaultAdminDelay or rollbackDefaultAdminDelay             │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule noPendingDefaultAdminDelayChange(env e, method f, calldataarg args) {
  uint48 pendingDelayBefore = _pendingDelay(e);
  f@withrevert(e, args);
  uint48 pendingDelayAfter = _pendingDelay(e);

  assert pendingDelayBefore != pendingDelayAfter => (
    f.selector == changeDefaultAdminDelay(uint48).selector ||
    (f.selector == rollbackDefaultAdminDelay().selector && pendingDelayAfter == 0)
  ), "pending delay is only affected by changeDefaultAdminDelay or rollbackDefaultAdminDelay";
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Rule: defaultAdminDelayIncreaseWait can't be changed atomically by any function                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule noDefaultAdminDelayIncreaseWaitChange(env e, method f, calldataarg args) {
  uint48 delayIncreaseWaitBefore = defaultAdminDelayIncreaseWait();
  f@withrevert(e, args);
  uint48 delayIncreaseWaitAfter = defaultAdminDelayIncreaseWait();

  assert delayIncreaseWaitBefore == delayIncreaseWaitAfter, 
    "delay increase wait can't be changed atomically by any function";
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Function correctness: beginDefaultAdminTransfer sets a pending default admin and its schedule                       │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule beginDefaultAdminTransfer(env e, address newAdmin) {
  require nonpayable(e);
  require timeSanity(e);
  requireInvariant defaultAdminConsistency(defaultAdmin());
  requireInvariant singleDefaultAdmin(e.msg.sender, defaultAdmin());

  beginDefaultAdminTransfer@withrevert(e, newAdmin);
  bool success = !lastReverted;

  // liveness
  assert success <=> e.msg.sender == defaultAdmin(), 
    "only the current default admin can begin a transfer";

  // effect
  assert success => _pendingDefaultAdmin(e) == newAdmin, 
    "pending default admin is set";
  assert success => _pendingDefaultAdminSchedule(e) == e.block.timestamp + defaultAdminDelay(e), 
    "pending default admin delay is set";
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Rule: pending default admin and it schedule can only change together                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule pendingAdminAndScheduleCoupling(env e, address newAdmin) {
  requireInvariant defaultAdminConsistency(defaultAdmin());
  requireInvariant singleDefaultAdmin(e.msg.sender, defaultAdmin());

  address pendingAdminBefore = _pendingDefaultAdmin(e);
  uint48 scheduleBefore = _pendingDefaultAdminSchedule(e);

  beginDefaultAdminTransfer(e, newAdmin);

  assert (
    scheduleBefore != _pendingDefaultAdminSchedule(e) &&
    pendingAdminBefore == _pendingDefaultAdmin(e)
  ) => newAdmin == pendingAdminBefore, "pending admin stays the same if the new admin set is the same";
  assert (
    pendingAdminBefore != _pendingDefaultAdmin(e) &&
    scheduleBefore == _pendingDefaultAdminSchedule(e)
  ) => (
    // Schedule doesn't change if:
    // - The previous schedule is block.timestamp and the delay is 0
    (e.block.timestamp == scheduleBefore && defaultAdminDelay(e) == 0) ||
    // - The defaultAdminDelay was reduced to a value such that added to the block.timestamp is equal to previous schedule
    e.block.timestamp + defaultAdminDelay(e) == scheduleBefore
  ), "pending admin stays the same if a default admin transfer is begun on accepted edge cases";
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Function correctness: acceptDefaultAdminTransfer updates defaultAdmin resetting the pending admin and its schedule  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule acceptDefaultAdminTransfer(env e) {
  require nonpayable(e);
  requireInvariant defaultAdminConsistency(defaultAdmin());
  requireInvariant singleDefaultAdmin(e.msg.sender, defaultAdmin());
  
  address pendingAdminBefore = _pendingDefaultAdmin(e);
  uint48 scheduleAfter = _pendingDefaultAdminSchedule(e);

  acceptDefaultAdminTransfer@withrevert(e);
  bool success = !lastReverted;

  // liveness
  assert success <=> e.msg.sender == pendingAdminBefore && isSet(scheduleAfter) && hasPassed(e, scheduleAfter), 
    "only the pending default admin can accept the role after the schedule has been set and passed";

  // effect
  assert success => defaultAdmin() == pendingAdminBefore,
    "Default admin is set to the previous pending default admin";
  assert success => _pendingDefaultAdmin(e) == 0, 
    "Pending default admin is reset";
  assert success => _pendingDefaultAdminSchedule(e) == 0,
    "Pending default admin delay is reset";
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Function correctness: cancelDefaultAdminTransfer resets pending default admin and its schedule                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule cancelDefaultAdminTransfer(env e) {
  require nonpayable(e);
  requireInvariant defaultAdminConsistency(defaultAdmin());
  requireInvariant singleDefaultAdmin(e.msg.sender, defaultAdmin());

  cancelDefaultAdminTransfer@withrevert(e);
  bool success = !lastReverted;

  // liveness
  assert success <=> e.msg.sender == defaultAdmin(),
    "only the current default admin can cancel a transfer";

  // effect
  assert success => _pendingDefaultAdmin(e) == 0, 
    "Pending default admin is reset";
  assert success => _pendingDefaultAdminSchedule(e) == 0,
    "Pending default admin delay is reset";
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Function correctness: changeDefaultAdminDelay sets a pending default admin delay and its schedule                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule changeDefaultAdminDelay(env e, uint48 newDelay) {
  require nonpayable(e);
  require timeSanity(e);
  require delayChangeWaitSanity(e, newDelay);
  requireInvariant defaultAdminConsistency(defaultAdmin());
  requireInvariant singleDefaultAdmin(e.msg.sender, defaultAdmin());

  uint48 delayBefore = defaultAdminDelay(e);

  changeDefaultAdminDelay@withrevert(e, newDelay);
  bool success = !lastReverted;

  // liveness
  assert success <=> e.msg.sender == defaultAdmin(), 
    "only the current default admin can begin a delay change";

  // effect
  assert success => _pendingDelay(e) == newDelay, "pending delay is set";
  assert success => (
    _pendingDelaySchedule(e) > e.block.timestamp || 
    delayBefore == newDelay || // Interpreted as decreasing, x - x = 0
    defaultAdminDelayIncreaseWait() == 0
  ),
    "pending delay schedule is set in the future unless accepted edge cases";
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Rule: pending delay wait is set depending on increasing or decreasing the delay                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule pendingDelayWait(env e, uint48 newDelay) {
  changeDefaultAdminDelay(e, newDelay);

  assert newDelay > defaultAdminDelay(e) => _pendingDelaySchedule(e) == e.block.timestamp + min(newDelay, defaultAdminDelayIncreaseWait()),
    "Delay wait is the minimum between the new delay and a threshold when the delay is increased";
  assert newDelay <= defaultAdminDelay(e) => _pendingDelaySchedule(e) == e.block.timestamp + defaultAdminDelay(e) - newDelay,
    "Delay wait is the difference between the current and the new delay when the delay is decreased";
}

/* 
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Rule: pending default admin delay and it schedule can only change together                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule pendingDelayAndScheduleCoupling(env e, uint48 newDelay) {
  requireInvariant defaultAdminConsistency(defaultAdmin());
  requireInvariant singleDefaultAdmin(e.msg.sender, defaultAdmin());

  address pendingDelayBefore = _pendingDelay(e);
  uint48 scheduleBefore = _pendingDelaySchedule(e);

  beginDefaultAdminTransfer(e, newDelay);

  assert (
    scheduleBefore != _pendingDelaySchedule(e) &&
    pendingDelayBefore == _pendingDelay(e)
  ) => newDelay == pendingDelayBefore, "pending delay stays the same if the new delay set is the same";
  assert (
    pendingDelayBefore != _pendingDelay(e) &&
    scheduleBefore == _pendingDelaySchedule(e)
  ) => (
    (e.block.timestamp + min(newDelay, defaultAdminDelayIncreaseWait())) == scheduleBefore || // Increasing
    (e.block.timestamp + defaultAdminDelay(e) - newDelay) == scheduleBefore // Decreasing
  ), "pending delay stays the same if a default admin transfer is begun on accepted edge cases";
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Function correctness: rollbackDefaultAdminDelay resets the delay and its schedule                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule rollbackDefaultAdminDelay(env e) {
  require nonpayable(e);
  requireInvariant defaultAdminConsistency(defaultAdmin());
  requireInvariant singleDefaultAdmin(e.msg.sender, defaultAdmin());

  rollbackDefaultAdminDelay@withrevert(e);
  bool success = !lastReverted;

  // liveness
  assert success <=> e.msg.sender == defaultAdmin(),
    "only the current default admin can rollback a delay change";

  // effect
  assert success => _pendingDelay(e) == 0, 
    "Pending default admin is reset";
  assert success => _pendingDelaySchedule(e) == 0,
    "Pending default admin delay is reset";
}
