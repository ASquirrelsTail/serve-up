<script>
  import DailyOrders from './DailyOrders.svelte';
  import TableList from './TableList.svelte';
  import MenuEdit from './MenuEdit.svelte';
  let current = DailyOrders;
</script>

<h1 class="center">Dashboard</h1>
<div class="center">
  <button class="primary md" on:click="{() => current = DailyOrders}">Orders</button>
  <button class="primary md" on:click="{() => current = TableList}">Tables</button>
  <button class="primary md" on:click="{() => current = MenuEdit}">Menu</button>
  <button class="secondary md" on:click="{() => window.location = '/admin/logout/'}">Log Out</button>
</div>


<svelte:component this={current}/>

<style>
  
</style>