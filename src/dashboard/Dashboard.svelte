<script>
  import DailyOrders from './DailyOrders.svelte';
  import TableList from './TableList.svelte';
  let current = DailyOrders;
</script>

<h1 class="center">Dashboard</h1>
<button class="primary" on:click="{() => current = DailyOrders}">Orders</button>
<button class="primary" on:click="{() => current = TableList}">Tables</button>
<button>Menu</button>
<a href="/admin/logout/">Log Out</a>

{#if current === DailyOrders}
<DailyOrders />
{/if}

{#if current === TableList}
<TableList />
{/if}

<style>
  
</style>