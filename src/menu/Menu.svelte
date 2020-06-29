<script>
  import MenuSection from './MenuSection.svelte';
  import Order from '../order/Order.svelte';

  let orderElHeight;

  let menuItems = fetch('/menu/')
                    .then(response => response.json())
                    .then(data => data.sections);
</script>

<article style="padding-bottom: {orderElHeight}px;">
  <h1>Menu</h1>
  {#await menuItems}
  <p>Loading Menu</p>
  {:then sections}
  {#each sections as section (section.id)}
  <MenuSection {...section} />
  {/each}
  {:catch error}
  <p>Oops something went wrong when trying to load the menu.</p>
  {/await}
</article>

<Order bind:orderElHeight={orderElHeight}/>

<style>
  h1 {
    text-align: center;
  }
</style>