## Role

- signal
- memo
- effect

### signal

- signal => memo
- signal => effect

If signal is in a batch operation, set signal value can be delayed, if it's the first setting. Other, it would not any broadcast. 
    => private an dirty sign to record the current status: clean and dirty.

If signal value is changed, the subscribers can get the notification from the source.
Only the first subscriber can check the dirty sign, but the follow subscribers could only get the clean dirty, because of the dirty sign has been changed to clean sign after the first subscriber checked.
You can compare the new value and the old value, but need to add a reference to the old value.
If the count of the variable signal value is not large, you would prevent the work of the GC of javascript, this would cause some excepted issuses, so we need another comparer for the value changed.
I think the number is the best choice, because it's the value type, not reference type. It would be reuse for all the same references of the variable, and stored in the stack, not the heap.
    => a readonly version to identify the current object: increase one if the value has been changed.

For the reference object, if the business value has not changed, it should not publish a broadcast.
We can add a comparer parameter for the custom comparer, the default value is the reference equal judgement.
To enhance the comparer, we can compare doubly: the first comparison is the reference equal judgement, and the second comparison is the custom comparison by user.
    => private comparison would be used in the set value action: the first comparsion reduce the performance overhead.
