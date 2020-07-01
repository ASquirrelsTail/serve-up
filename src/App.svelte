<script>
  import SignIn from './checkin/CheckIn.svelte';
  import Menu from './menu/Menu.svelte';
  import Dashboard from './dashboard/Dashboard.svelte';
  import { group, user } from './store.js';
</script>
<main>
{#if $user}
<Dashboard />
{:else if $group}
<Menu />
{:else}
<SignIn />
{/if}
</main>