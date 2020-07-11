<script>
  import Review from '../Review.svelte';
  import TableUpdate from './TableUpdate.svelte'
  import { toData } from '../fetch.js';
  let allTables = fetch('/tables/').then(toData)
    .then(data => data.tables);

  let review = false;

  function update(e) {
    allTables = allTables.then(tables => {
      const index = tables.findIndex(table => table.id === e.detail.id);
      if (index < 0) tables.push(e.detail);
      else tables[index] = e.detail;
      return [...tables];
    });
  }

  function delTable(e) {
    allTables = allTables.then(tables => {
      review = false;
      return [...tables.filter(table => table.id !== e.detail)];
    });
  }

</script>

<h2>Tables</h2>
<div class="section">
  {#await allTables then tables}
    {#each tables as table (table.id)}
      <div class="table striped">
        <div>Table {table.name}</div>
        <button class="primary md" on:click="{() => review=table}">View</button>
      </div>
    {/each}
  {/await}
</div>

<div class="add-new">
  <button class="primary md" on:click="{() => review={}}">Add New</button>
</div>

<Review bind:review={review}>
  <TableUpdate table={review} on:delete={delTable} on:update={update}/>
</Review>

<style>
  .table {
    padding: 0.2em;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .add-new {
    text-align: center;
    margin: 0.5em;
  }
</style>