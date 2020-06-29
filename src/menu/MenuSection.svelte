<script>
  import MenuItem from './MenuItem.svelte';
  export let name = 'Menu Section';
  export let description = false;
  export let id = false;
  export let order = 1;
  export let items = [];
  
</script>

<section class="menu-section">
  <div class="details">
    <h2>{name}</h2>
    {#if description}
    <p class="description">{description}</p>
    {/if}
  </div>
  
  {#each items as item (item.id)}
  <MenuItem {...item} />
  {/each}
</section>

<style>
  .menu-section {
    margin: 0.2em;
    border: 1px solid grey;
    border-radius: 0.2em;
  }

  .details {
    padding: 0 0.2em;
  }
</style>

