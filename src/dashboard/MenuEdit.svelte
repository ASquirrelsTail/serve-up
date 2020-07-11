<script>
  import Review from '../Review.svelte';
  import MenuSectionUpdate from './MenuSectionUpdate.svelte';
  import MenuItemUpdate from './MenuItemUpdate.svelte';
  import DashboardMenuItem from './DashboardMenuItem.svelte';

  let review = false;
  let reviewData = {};
  
  let menuItems = fetch('/menu/')
                    .then(response => response.json())
                    .then(data => {
                      console.log(data.sections)
                      return data.sections});

  function openSectionUpdate(section) {
    review = MenuSectionUpdate;
    reviewData = {section: section};
  }

  function openItemUpdate(item) {
    review = MenuItemUpdate;
    reviewData = {item: item};
  }
</script>

<h2>Menu</h2>
<div>
  {#await menuItems then sections}
    {#each sections as section (section.id)}
      <div class="section" class:hidden={!section.visible}>
        <div class="section-inner">
          <div class="details">
            <h3>{section.name}</h3>
            <p class="description">{section.description}</p>
          </div>
          <div>
            <button class="primary md" on:click="{() => openSectionUpdate(section)}">Edit</button>
          </div>
          <div class="up-down"><button class="primary">+</button> <button class="primary">-</button></div>
        </div>
        <div>
          {#each section.items as item}
          <DashboardMenuItem {item} on:edititem="{(e) => openItemUpdate(e.detail)}"/>
          {/each}
        </div>
        <div class="add-new">
          <button class="primary md"  on:click="{() => review=MenuItemUpdate}">Add New Item</button>
        </div>
      </div>
    {/each}
  {/await}
</div>

<div class="add-new">
  <button class="primary md" on:click="{() => review=MenuSectionUpdate}">Add New Menu Section</button>
</div>

<Review bind:review={review}>
  <svelte:component this={review} {...reviewData}/>
  <div class="back">
    <button class="primary md" on:click="{() => review=false}">Back to menu</button>
  </div>
</Review>

<style>
  .section-inner {
    display: flex;
    align-items: center;
  }

  .details {
    flex-grow: 1;
    padding: 0 0.2em;
  }

  .add-new {
    text-align: center;
    margin: 0.5em;
  }

  .back {
    text-align: center;
  }

  .up-down button {
    display: block;
    width: 1em;
    height: 1em;
    margin: 0.2em;
    margin-left: 0.4em;
    margin-right: 0.4em;
    padding: 0;
  }
</style>