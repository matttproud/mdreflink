This document tests cleanup of redundant full-form references that span
multiple lines, particularly when they exceed the 80-character line limit.

Let's see what happens [when lines overflow](about:blank), [when lines
overflow](about:blank), [when lines overflow](about:blank), [when lines
overflow](about:blank), [when lines overflow](about:blank), and [when lines
overflow](about:blank), and [when lines overflow](about:blank), and [when lines
overflow](about:blank), moreover [when lines overflow](about:blank), and [when
lines overflow](about:blank), and [when lines overflow](about:blank), and [when
lines overflow](about:blank).
Also test with multiline spanning:

I am pretty fucking disappointed with text canonicalization as [this is a very
long multiline link text that spans the extent of my patience](about:blank).
