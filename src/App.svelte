<script>
  import SignIn from './checkin/CheckIn.svelte';
  import { group } from './store.js';
</script>
{#if $group}
<p>We have a group.</p>
{:else}
<SignIn />
{/if}