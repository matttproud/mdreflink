> The advantage of using a prime is less clear, but it is traditional. A nice
> property of 31 is that the multiplication can be replaced by a shift and a
> subtraction for better performance: 31 \* i == (i << 5) - i. Modern [Java] VMs
> do this sort of optimization automatically.
>
> This shows \* escaped asterisks and [square brackets] are preserved correctly.
