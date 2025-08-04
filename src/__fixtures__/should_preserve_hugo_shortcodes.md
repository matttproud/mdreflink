---
title: "Hugo Shortcode Test"
---

# Hugo Shortcode Test

But this normal link should be transformed: [normal link](https://example.com)

And this reference link should be preserved: [preserved link][preserved]

{{% foo %}} ## Section 1 {{% /foo %}}

{{< bar >}} ## Section 2 {{< /bar >}}

Some text with {{% highlight go %}} code here {{% /highlight %}} and more text.

Also {{< figure src="image.jpg" >}} caption text {{< /figure >}} works.

[preserved]: https://preserved.com

<!-- The following definitions contain Hugo shortcodes and should not have < > or % escaped -->
[example]: {{<ref "foo.md" >}}
[another]: {{< relref "bar.md" >}}
[shortcode]: {{< myshortcode param="value" >}}
[percent_example]: {{% ref "baz.md" %}}
[percent_relref]: {{% relref "qux.md" %}}
[percent_shortcode]: {{% myshortcode param="value" %}}
