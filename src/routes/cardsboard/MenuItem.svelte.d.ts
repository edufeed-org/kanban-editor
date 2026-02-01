import type { Component } from 'svelte';
interface Props {
    icon: Component;
    label: string;
    onclick: () => void;
    disabled?: boolean;
    showBorder?: boolean;
    showChevron?: boolean;
    variant?: 'default' | 'danger';
}
declare const MenuItem: Component<Props, {}, "">;
type MenuItem = ReturnType<typeof MenuItem>;
export default MenuItem;
