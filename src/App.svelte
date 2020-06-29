<script>
  import SignIn from './checkin/CheckIn.svelte';
  import Menu from './menu/Menu.svelte';
  import { group } from './store.js';
</script>
<main>
{#if $group}
<Menu />
{:else}
<SignIn />
{/if}
</main>