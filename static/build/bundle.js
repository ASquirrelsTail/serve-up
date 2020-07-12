var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function is_promise(value) {
        return value && typeof value === 'object' && typeof value.then === 'function';
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function set_store_value(store, ret, value = ret) {
        store.set(value);
        return ret;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? undefined : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    // unfortunately this can't be a constant as that wouldn't be tree-shakeable
    // so we cache the result instead
    let crossorigin;
    function is_crossorigin() {
        if (crossorigin === undefined) {
            crossorigin = false;
            try {
                if (typeof window !== 'undefined' && window.parent) {
                    void window.parent.document;
                }
            }
            catch (error) {
                crossorigin = true;
            }
        }
        return crossorigin;
    }
    function add_resize_listener(node, fn) {
        const computed_style = getComputedStyle(node);
        const z_index = (parseInt(computed_style.zIndex) || 0) - 1;
        if (computed_style.position === 'static') {
            node.style.position = 'relative';
        }
        const iframe = element('iframe');
        iframe.setAttribute('style', `display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; ` +
            `overflow: hidden; border: 0; opacity: 0; pointer-events: none; z-index: ${z_index};`);
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        const crossorigin = is_crossorigin();
        let unsubscribe;
        if (crossorigin) {
            iframe.src = `data:text/html,<script>onresize=function(){parent.postMessage(0,'*')}</script>`;
            unsubscribe = listen(window, 'message', (event) => {
                if (event.source === iframe.contentWindow)
                    fn();
            });
        }
        else {
            iframe.src = 'about:blank';
            iframe.onload = () => {
                unsubscribe = listen(iframe.contentWindow, 'resize', fn);
            };
        }
        append(node, iframe);
        return () => {
            if (crossorigin) {
                unsubscribe();
            }
            else if (unsubscribe && iframe.contentWindow) {
                unsubscribe();
            }
            detach(iframe);
        };
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                info.blocks[i] = null;
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error(`Cannot have duplicate keys in a keyed each`);
            }
            keys.add(key);
        }
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.23.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/checkin/Visitor.svelte generated by Svelte v3.23.2 */

    const file = "src/checkin/Visitor.svelte";

    function create_fragment(ctx) {
    	let div6;
    	let form;
    	let div1;
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let div0;
    	let t3_value = /*errors*/ ctx[3].name + "";
    	let t3;
    	let t4;
    	let div3;
    	let label1;
    	let t6;
    	let input1;
    	let t7;
    	let div2;
    	let t8_value = /*errors*/ ctx[3].phone_number + "";
    	let t8;
    	let t9;
    	let div5;
    	let label2;
    	let t11;
    	let input2;
    	let t12;
    	let div4;
    	let t13_value = /*errors*/ ctx[3].email + "";
    	let t13;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			form = element("form");
    			div1 = element("div");
    			label0 = element("label");
    			label0.textContent = "Name:";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			div0 = element("div");
    			t3 = text(t3_value);
    			t4 = space();
    			div3 = element("div");
    			label1 = element("label");
    			label1.textContent = "Tel:";
    			t6 = space();
    			input1 = element("input");
    			t7 = space();
    			div2 = element("div");
    			t8 = text(t8_value);
    			t9 = space();
    			div5 = element("div");
    			label2 = element("label");
    			label2.textContent = "Email:";
    			t11 = space();
    			input2 = element("input");
    			t12 = space();
    			div4 = element("div");
    			t13 = text(t13_value);
    			attr_dev(label0, "for", "name");
    			attr_dev(label0, "class", "svelte-kr569m");
    			add_location(label0, file, 15, 6, 339);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "name");
    			input0.disabled = /*disabled*/ ctx[4];
    			attr_dev(input0, "class", "svelte-kr569m");
    			add_location(input0, file, 16, 6, 377);
    			attr_dev(div0, "class", "error svelte-kr569m");
    			add_location(div0, file, 17, 6, 463);
    			attr_dev(div1, "class", "input-row svelte-kr569m");
    			toggle_class(div1, "invalid", /*errors*/ ctx[3].name);
    			add_location(div1, file, 14, 4, 281);
    			attr_dev(label1, "for", "phone_number");
    			attr_dev(label1, "class", "svelte-kr569m");
    			add_location(label1, file, 20, 6, 583);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "phone_number");
    			input1.disabled = /*disabled*/ ctx[4];
    			attr_dev(input1, "class", "svelte-kr569m");
    			add_location(input1, file, 21, 6, 628);
    			attr_dev(div2, "class", "error svelte-kr569m");
    			add_location(div2, file, 22, 6, 730);
    			attr_dev(div3, "class", "input-row svelte-kr569m");
    			toggle_class(div3, "invalid", /*errors*/ ctx[3].phone_number);
    			add_location(div3, file, 19, 4, 517);
    			attr_dev(label2, "for", "email");
    			attr_dev(label2, "class", "svelte-kr569m");
    			add_location(label2, file, 25, 6, 852);
    			attr_dev(input2, "type", "email");
    			attr_dev(input2, "id", "email");
    			input2.disabled = /*disabled*/ ctx[4];
    			attr_dev(input2, "class", "svelte-kr569m");
    			add_location(input2, file, 26, 6, 892);
    			attr_dev(div4, "class", "error svelte-kr569m");
    			add_location(div4, file, 27, 6, 981);
    			attr_dev(div5, "class", "input-row svelte-kr569m");
    			toggle_class(div5, "invalid", /*errors*/ ctx[3].email);
    			add_location(div5, file, 24, 4, 792);
    			add_location(form, file, 13, 2, 245);
    			attr_dev(div6, "class", "visitor svelte-kr569m");
    			add_location(div6, file, 12, 0, 221);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, form);
    			append_dev(form, div1);
    			append_dev(div1, label0);
    			append_dev(div1, t1);
    			append_dev(div1, input0);
    			set_input_value(input0, /*name*/ ctx[0]);
    			append_dev(div1, t2);
    			append_dev(div1, div0);
    			append_dev(div0, t3);
    			append_dev(form, t4);
    			append_dev(form, div3);
    			append_dev(div3, label1);
    			append_dev(div3, t6);
    			append_dev(div3, input1);
    			set_input_value(input1, /*phone_number*/ ctx[1]);
    			append_dev(div3, t7);
    			append_dev(div3, div2);
    			append_dev(div2, t8);
    			append_dev(form, t9);
    			append_dev(form, div5);
    			append_dev(div5, label2);
    			append_dev(div5, t11);
    			append_dev(div5, input2);
    			set_input_value(input2, /*email*/ ctx[2]);
    			append_dev(div5, t12);
    			append_dev(div5, div4);
    			append_dev(div4, t13);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[7]),
    					listen_dev(input0, "change", /*onChange*/ ctx[5], false, false, false),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[8]),
    					listen_dev(input1, "change", /*onChange*/ ctx[5], false, false, false),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[9]),
    					listen_dev(input2, "change", /*onChange*/ ctx[5], false, false, false),
    					listen_dev(form, "submit", prevent_default(/*submit_handler*/ ctx[6]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*disabled*/ 16) {
    				prop_dev(input0, "disabled", /*disabled*/ ctx[4]);
    			}

    			if (dirty & /*name*/ 1 && input0.value !== /*name*/ ctx[0]) {
    				set_input_value(input0, /*name*/ ctx[0]);
    			}

    			if (dirty & /*errors*/ 8 && t3_value !== (t3_value = /*errors*/ ctx[3].name + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*errors*/ 8) {
    				toggle_class(div1, "invalid", /*errors*/ ctx[3].name);
    			}

    			if (dirty & /*disabled*/ 16) {
    				prop_dev(input1, "disabled", /*disabled*/ ctx[4]);
    			}

    			if (dirty & /*phone_number*/ 2 && input1.value !== /*phone_number*/ ctx[1]) {
    				set_input_value(input1, /*phone_number*/ ctx[1]);
    			}

    			if (dirty & /*errors*/ 8 && t8_value !== (t8_value = /*errors*/ ctx[3].phone_number + "")) set_data_dev(t8, t8_value);

    			if (dirty & /*errors*/ 8) {
    				toggle_class(div3, "invalid", /*errors*/ ctx[3].phone_number);
    			}

    			if (dirty & /*disabled*/ 16) {
    				prop_dev(input2, "disabled", /*disabled*/ ctx[4]);
    			}

    			if (dirty & /*email*/ 4 && input2.value !== /*email*/ ctx[2]) {
    				set_input_value(input2, /*email*/ ctx[2]);
    			}

    			if (dirty & /*errors*/ 8 && t13_value !== (t13_value = /*errors*/ ctx[3].email + "")) set_data_dev(t13, t13_value);

    			if (dirty & /*errors*/ 8) {
    				toggle_class(div5, "invalid", /*errors*/ ctx[3].email);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { name = "" } = $$props;
    	let { phone_number = "" } = $$props;
    	let { email = "" } = $$props;
    	let { errors = {} } = $$props;
    	let { disabled = false } = $$props;

    	function onChange(e) {
    		$$invalidate(3, errors[e.target.id] = false, errors);
    	}

    	const writable_props = ["name", "phone_number", "email", "errors", "disabled"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Visitor> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Visitor", $$slots, []);

    	function submit_handler(event) {
    		bubble($$self, event);
    	}

    	function input0_input_handler() {
    		name = this.value;
    		$$invalidate(0, name);
    	}

    	function input1_input_handler() {
    		phone_number = this.value;
    		$$invalidate(1, phone_number);
    	}

    	function input2_input_handler() {
    		email = this.value;
    		$$invalidate(2, email);
    	}

    	$$self.$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("phone_number" in $$props) $$invalidate(1, phone_number = $$props.phone_number);
    		if ("email" in $$props) $$invalidate(2, email = $$props.email);
    		if ("errors" in $$props) $$invalidate(3, errors = $$props.errors);
    		if ("disabled" in $$props) $$invalidate(4, disabled = $$props.disabled);
    	};

    	$$self.$capture_state = () => ({
    		name,
    		phone_number,
    		email,
    		errors,
    		disabled,
    		onChange
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("phone_number" in $$props) $$invalidate(1, phone_number = $$props.phone_number);
    		if ("email" in $$props) $$invalidate(2, email = $$props.email);
    		if ("errors" in $$props) $$invalidate(3, errors = $$props.errors);
    		if ("disabled" in $$props) $$invalidate(4, disabled = $$props.disabled);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		name,
    		phone_number,
    		email,
    		errors,
    		disabled,
    		onChange,
    		submit_handler,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler
    	];
    }

    class Visitor extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			name: 0,
    			phone_number: 1,
    			email: 2,
    			errors: 3,
    			disabled: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Visitor",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get name() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get phone_number() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set phone_number(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get email() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set email(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get errors() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set errors(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function request(endpoint, method, data) {
      return fetch(endpoint, {
        method: method,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        body: JSON.stringify(data)
      });
    }

    function post(endpoint, data) {
      return request(endpoint, 'POST', data);
    }

    function patch(endpoint, data) {
      return request(endpoint, 'PATCH', data);
    }

    function del(endpoint) {
      return request(endpoint, 'Delete', {});
    }

    function toData(response) {
      if (response.status === 200) return response.json();else if (response.status === 403) window.location.replace('/admin/login/?next=/dashboard/');
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const group = writable(document.body.dataset.group);
    const user = writable(document.body.dataset.user);
    const orderList = writable([]);

    orderList.addOrUpdate = function (item) {
      this.update(order => {
        const updatedItem = order.find(orderItem => orderItem.id === item.id);
        if (updatedItem) updatedItem.count = item.count;else if (item.count > 0) order.push(item);
        return order.filter(item => item.count > 0);
      });
    };

    /* src/checkin/CheckIn.svelte generated by Svelte v3.23.2 */
    const file$1 = "src/checkin/CheckIn.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	child_ctx[13] = list;
    	child_ctx[14] = i;
    	return child_ctx;
    }

    // (40:0) {#each visitors as visitor, i (i)}
    function create_each_block(key_1, ctx) {
    	let first;
    	let visitor;
    	let updating_name;
    	let updating_email;
    	let updating_phone_number;
    	let current;

    	function visitor_name_binding(value) {
    		/*visitor_name_binding*/ ctx[8].call(null, value, /*visitor*/ ctx[12]);
    	}

    	function visitor_email_binding(value) {
    		/*visitor_email_binding*/ ctx[9].call(null, value, /*visitor*/ ctx[12]);
    	}

    	function visitor_phone_number_binding(value) {
    		/*visitor_phone_number_binding*/ ctx[10].call(null, value, /*visitor*/ ctx[12]);
    	}

    	let visitor_props = {
    		errors: /*errors*/ ctx[1][/*i*/ ctx[14]],
    		disabled: /*disabled*/ ctx[4]
    	};

    	if (/*visitor*/ ctx[12].name !== void 0) {
    		visitor_props.name = /*visitor*/ ctx[12].name;
    	}

    	if (/*visitor*/ ctx[12].email !== void 0) {
    		visitor_props.email = /*visitor*/ ctx[12].email;
    	}

    	if (/*visitor*/ ctx[12].phone_number !== void 0) {
    		visitor_props.phone_number = /*visitor*/ ctx[12].phone_number;
    	}

    	visitor = new Visitor({ props: visitor_props, $$inline: true });
    	binding_callbacks.push(() => bind(visitor, "name", visitor_name_binding));
    	binding_callbacks.push(() => bind(visitor, "email", visitor_email_binding));
    	binding_callbacks.push(() => bind(visitor, "phone_number", visitor_phone_number_binding));

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(visitor.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(visitor, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const visitor_changes = {};
    			if (dirty & /*errors, visitors*/ 3) visitor_changes.errors = /*errors*/ ctx[1][/*i*/ ctx[14]];
    			if (dirty & /*disabled*/ 16) visitor_changes.disabled = /*disabled*/ ctx[4];

    			if (!updating_name && dirty & /*visitors*/ 1) {
    				updating_name = true;
    				visitor_changes.name = /*visitor*/ ctx[12].name;
    				add_flush_callback(() => updating_name = false);
    			}

    			if (!updating_email && dirty & /*visitors*/ 1) {
    				updating_email = true;
    				visitor_changes.email = /*visitor*/ ctx[12].email;
    				add_flush_callback(() => updating_email = false);
    			}

    			if (!updating_phone_number && dirty & /*visitors*/ 1) {
    				updating_phone_number = true;
    				visitor_changes.phone_number = /*visitor*/ ctx[12].phone_number;
    				add_flush_callback(() => updating_phone_number = false);
    			}

    			visitor.$set(visitor_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(visitor.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(visitor.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(visitor, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(40:0) {#each visitors as visitor, i (i)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let h1;
    	let t1;
    	let p0;
    	let t3;
    	let p1;
    	let t4;
    	let t5;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t6;
    	let div;
    	let button0;
    	let t7;
    	let t8;
    	let button1;
    	let t9;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*visitors*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*i*/ ctx[14];
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Check In";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Libero earum praesentium tempora fuga ipsam dolor sunt recusandae dicta possimus, animi dolore fugit labore nesciunt veniam vel officia, laboriosam deserunt molestiae!";
    			t3 = space();
    			p1 = element("p");
    			t4 = text(/*error*/ ctx[2]);
    			t5 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t6 = space();
    			div = element("div");
    			button0 = element("button");
    			t7 = text("Add another visitor");
    			t8 = space();
    			button1 = element("button");
    			t9 = text("Check In");
    			add_location(h1, file$1, 36, 0, 894);
    			add_location(p0, file$1, 37, 0, 912);
    			attr_dev(p1, "class", "error svelte-1m93kac");
    			toggle_class(p1, "visible", /*error*/ ctx[2]);
    			add_location(p1, file$1, 38, 0, 1145);
    			attr_dev(button0, "class", "primary md svelte-1m93kac");
    			button0.disabled = /*disabled*/ ctx[4];
    			add_location(button0, file$1, 47, 2, 1440);
    			attr_dev(button1, "class", "primary md svelte-1m93kac");
    			button1.disabled = /*disabled*/ ctx[4];
    			add_location(button1, file$1, 48, 2, 1546);
    			attr_dev(div, "class", "buttons svelte-1m93kac");
    			add_location(div, file$1, 46, 0, 1416);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p0, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t4);
    			/*p1_binding*/ ctx[7](p1);
    			insert_dev(target, t5, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, t6, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(button0, t7);
    			append_dev(div, t8);
    			append_dev(div, button1);
    			append_dev(button1, t9);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", prevent_default(/*addVisitor*/ ctx[5]), false, true, false),
    					listen_dev(button1, "click", prevent_default(/*checkIn*/ ctx[6]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*error*/ 4) set_data_dev(t4, /*error*/ ctx[2]);

    			if (dirty & /*error*/ 4) {
    				toggle_class(p1, "visible", /*error*/ ctx[2]);
    			}

    			if (dirty & /*errors, visitors, disabled*/ 19) {
    				const each_value = /*visitors*/ ctx[0];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, t6.parentNode, outro_and_destroy_block, create_each_block, t6, get_each_context);
    				check_outros();
    			}

    			if (!current || dirty & /*disabled*/ 16) {
    				prop_dev(button0, "disabled", /*disabled*/ ctx[4]);
    			}

    			if (!current || dirty & /*disabled*/ 16) {
    				prop_dev(button1, "disabled", /*disabled*/ ctx[4]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(p1);
    			/*p1_binding*/ ctx[7](null);
    			if (detaching) detach_dev(t5);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $group;
    	validate_store(group, "group");
    	component_subscribe($$self, group, $$value => $$invalidate(11, $group = $$value));
    	let visitors = [];
    	let errors = [];
    	addVisitor();
    	let error = "";
    	let errorMessage;
    	let disabled = false;

    	function addVisitor() {
    		$$invalidate(0, visitors = [...visitors, { name: "", phone_number: "", email: "" }]);
    		$$invalidate(1, errors = [...errors, {}]);
    	}

    	function checkIn() {
    		$$invalidate(4, disabled = true);

    		$$invalidate(0, visitors = [
    			visitors[0],
    			...visitors.slice(1).filter(visitor => visitor.name || visitor.email || visitor.phone_number)
    		]);

    		post("group/", { visitors }).then(async response => {
    			if (response.status === 204) set_store_value(group, $group = true); else {
    				const data = await response.json();
    				$$invalidate(2, error = data.error);
    				$$invalidate(1, errors = data.form_errors);
    				errorMessage.scrollIntoView();
    				$$invalidate(4, disabled = false);
    			}
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<CheckIn> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("CheckIn", $$slots, []);

    	function p1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			errorMessage = $$value;
    			$$invalidate(3, errorMessage);
    		});
    	}

    	function visitor_name_binding(value, visitor) {
    		visitor.name = value;
    		$$invalidate(0, visitors);
    	}

    	function visitor_email_binding(value, visitor) {
    		visitor.email = value;
    		$$invalidate(0, visitors);
    	}

    	function visitor_phone_number_binding(value, visitor) {
    		visitor.phone_number = value;
    		$$invalidate(0, visitors);
    	}

    	$$self.$capture_state = () => ({
    		Visitor,
    		post,
    		group,
    		visitors,
    		errors,
    		error,
    		errorMessage,
    		disabled,
    		addVisitor,
    		checkIn,
    		$group
    	});

    	$$self.$inject_state = $$props => {
    		if ("visitors" in $$props) $$invalidate(0, visitors = $$props.visitors);
    		if ("errors" in $$props) $$invalidate(1, errors = $$props.errors);
    		if ("error" in $$props) $$invalidate(2, error = $$props.error);
    		if ("errorMessage" in $$props) $$invalidate(3, errorMessage = $$props.errorMessage);
    		if ("disabled" in $$props) $$invalidate(4, disabled = $$props.disabled);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		visitors,
    		errors,
    		error,
    		errorMessage,
    		disabled,
    		addVisitor,
    		checkIn,
    		p1_binding,
    		visitor_name_binding,
    		visitor_email_binding,
    		visitor_phone_number_binding
    	];
    }

    class CheckIn extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CheckIn",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/Count.svelte generated by Svelte v3.23.2 */
    const file$2 = "src/Count.svelte";

    function create_fragment$2(ctx) {
    	let div;
    	let button0;
    	let t0;
    	let button0_disabled_value;
    	let t1;
    	let input;
    	let t2;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			button0 = element("button");
    			t0 = text("-");
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			button1 = element("button");
    			button1.textContent = "+";
    			attr_dev(button0, "class", "minus");
    			button0.disabled = button0_disabled_value = /*count*/ ctx[0] < 1;
    			add_location(button0, file$2, 21, 2, 384);
    			attr_dev(input, "type", "number");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "id", /*id*/ ctx[1]);
    			add_location(input, file$2, 22, 2, 460);
    			attr_dev(button1, "class", "plus");
    			add_location(button1, file$2, 23, 2, 535);
    			attr_dev(div, "class", "count svelte-jtajg8");
    			add_location(div, file$2, 20, 0, 362);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(button0, t0);
    			append_dev(div, t1);
    			append_dev(div, input);
    			set_input_value(input, /*count*/ ctx[0]);
    			append_dev(div, t2);
    			append_dev(div, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*remove*/ ctx[3], false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[5]),
    					listen_dev(input, "input", /*update*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*add*/ ctx[2], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*count*/ 1 && button0_disabled_value !== (button0_disabled_value = /*count*/ ctx[0] < 1)) {
    				prop_dev(button0, "disabled", button0_disabled_value);
    			}

    			if (dirty & /*id*/ 2) {
    				attr_dev(input, "id", /*id*/ ctx[1]);
    			}

    			if (dirty & /*count*/ 1 && to_number(input.value) !== /*count*/ ctx[0]) {
    				set_input_value(input, /*count*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { id = "" } = $$props;
    	let { count = 0 } = $$props;
    	const dispatch = createEventDispatcher();

    	function add() {
    		dispatch("count", count + 1);
    	}

    	function remove() {
    		dispatch("count", Math.max(count - 1, 0));
    	}

    	function update() {
    		dispatch("count", Math.max(count, 0));
    	}

    	const writable_props = ["id", "count"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Count> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Count", $$slots, []);

    	function input_input_handler() {
    		count = to_number(this.value);
    		$$invalidate(0, count);
    	}

    	$$self.$set = $$props => {
    		if ("id" in $$props) $$invalidate(1, id = $$props.id);
    		if ("count" in $$props) $$invalidate(0, count = $$props.count);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		id,
    		count,
    		dispatch,
    		add,
    		remove,
    		update
    	});

    	$$self.$inject_state = $$props => {
    		if ("id" in $$props) $$invalidate(1, id = $$props.id);
    		if ("count" in $$props) $$invalidate(0, count = $$props.count);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [count, id, add, remove, update, input_input_handler];
    }

    class Count extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { id: 1, count: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Count",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get id() {
    		throw new Error("<Count>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Count>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get count() {
    		throw new Error("<Count>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set count(value) {
    		throw new Error("<Count>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/menu/MenuItem.svelte generated by Svelte v3.23.2 */
    const file$3 = "src/menu/MenuItem.svelte";

    // (30:4) {#if description}
    function create_if_block(ctx) {
    	let p;
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*description*/ ctx[1]);
    			attr_dev(p, "class", "description");
    			add_location(p, file$3, 30, 4, 702);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*description*/ 2) set_data_dev(t, /*description*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(30:4) {#if description}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div3;
    	let div0;
    	let h3;
    	let label;
    	let t0;
    	let label_for_value;
    	let t1;
    	let t2;
    	let div2;
    	let div1;
    	let t3;
    	let t4;
    	let t5;
    	let t6;
    	let count_1;
    	let current;
    	let if_block = /*description*/ ctx[1] && create_if_block(ctx);

    	count_1 = new Count({
    			props: {
    				count: /*count*/ ctx[4],
    				id: "menu-count-" + /*id*/ ctx[3]
    			},
    			$$inline: true
    		});

    	count_1.$on("count", /*update*/ ctx[5]);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			h3 = element("h3");
    			label = element("label");
    			t0 = text(/*name*/ ctx[0]);
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();
    			div2 = element("div");
    			div1 = element("div");
    			t3 = text("£");
    			t4 = text(/*price*/ ctx[2]);
    			t5 = text(" ea.");
    			t6 = space();
    			create_component(count_1.$$.fragment);
    			attr_dev(label, "for", label_for_value = "menu-count-" + /*id*/ ctx[3]);
    			add_location(label, file$3, 28, 21, 627);
    			attr_dev(h3, "class", "name svelte-fmax8h");
    			add_location(h3, file$3, 28, 4, 610);
    			attr_dev(div0, "class", "details");
    			add_location(div0, file$3, 27, 2, 584);
    			attr_dev(div1, "class", "price svelte-fmax8h");
    			add_location(div1, file$3, 34, 4, 788);
    			attr_dev(div2, "class", "order svelte-fmax8h");
    			add_location(div2, file$3, 33, 2, 764);
    			attr_dev(div3, "class", "menu-item svelte-fmax8h");
    			add_location(div3, file$3, 26, 0, 558);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, h3);
    			append_dev(h3, label);
    			append_dev(label, t0);
    			append_dev(div0, t1);
    			if (if_block) if_block.m(div0, null);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			append_dev(div1, t3);
    			append_dev(div1, t4);
    			append_dev(div1, t5);
    			append_dev(div2, t6);
    			mount_component(count_1, div2, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*name*/ 1) set_data_dev(t0, /*name*/ ctx[0]);

    			if (!current || dirty & /*id*/ 8 && label_for_value !== (label_for_value = "menu-count-" + /*id*/ ctx[3])) {
    				attr_dev(label, "for", label_for_value);
    			}

    			if (/*description*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (!current || dirty & /*price*/ 4) set_data_dev(t4, /*price*/ ctx[2]);
    			const count_1_changes = {};
    			if (dirty & /*count*/ 16) count_1_changes.count = /*count*/ ctx[4];
    			if (dirty & /*id*/ 8) count_1_changes.id = "menu-count-" + /*id*/ ctx[3];
    			count_1.$set(count_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(count_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(count_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (if_block) if_block.d();
    			destroy_component(count_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $orderList;
    	validate_store(orderList, "orderList");
    	component_subscribe($$self, orderList, $$value => $$invalidate(9, $orderList = $$value));
    	let { name = "Menu Item" } = $$props;
    	let { description = false } = $$props;
    	let { price = "0.00" } = $$props;
    	let { vat = true } = $$props;
    	let { id } = $$props;
    	let { order = 1 } = $$props;
    	let { visible = true } = $$props;
    	let count = 0;

    	function update(e) {
    		$$invalidate(4, count = e.detail);
    		orderList.addOrUpdate({ id, name, price, vat, count });
    	}

    	const writable_props = ["name", "description", "price", "vat", "id", "order", "visible"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MenuItem> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("MenuItem", $$slots, []);

    	$$self.$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("description" in $$props) $$invalidate(1, description = $$props.description);
    		if ("price" in $$props) $$invalidate(2, price = $$props.price);
    		if ("vat" in $$props) $$invalidate(6, vat = $$props.vat);
    		if ("id" in $$props) $$invalidate(3, id = $$props.id);
    		if ("order" in $$props) $$invalidate(7, order = $$props.order);
    		if ("visible" in $$props) $$invalidate(8, visible = $$props.visible);
    	};

    	$$self.$capture_state = () => ({
    		Count,
    		orderList,
    		name,
    		description,
    		price,
    		vat,
    		id,
    		order,
    		visible,
    		count,
    		update,
    		$orderList
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("description" in $$props) $$invalidate(1, description = $$props.description);
    		if ("price" in $$props) $$invalidate(2, price = $$props.price);
    		if ("vat" in $$props) $$invalidate(6, vat = $$props.vat);
    		if ("id" in $$props) $$invalidate(3, id = $$props.id);
    		if ("order" in $$props) $$invalidate(7, order = $$props.order);
    		if ("visible" in $$props) $$invalidate(8, visible = $$props.visible);
    		if ("count" in $$props) $$invalidate(4, count = $$props.count);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$orderList, id*/ 520) {
    			 {
    				const orderItem = $orderList.find(item => item.id === id);
    				if (orderItem) $$invalidate(4, count = orderItem.count); else $$invalidate(4, count = 0);
    			}
    		}
    	};

    	return [name, description, price, id, count, update, vat, order, visible];
    }

    class MenuItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			name: 0,
    			description: 1,
    			price: 2,
    			vat: 6,
    			id: 3,
    			order: 7,
    			visible: 8
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MenuItem",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*id*/ ctx[3] === undefined && !("id" in props)) {
    			console.warn("<MenuItem> was created without expected prop 'id'");
    		}
    	}

    	get name() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get description() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set description(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get price() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set price(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get vat() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set vat(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get order() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set order(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get visible() {
    		throw new Error("<MenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set visible(value) {
    		throw new Error("<MenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/menu/MenuSection.svelte generated by Svelte v3.23.2 */
    const file$4 = "src/menu/MenuSection.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (14:4) {#if description}
    function create_if_block$1(ctx) {
    	let p;
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*description*/ ctx[1]);
    			attr_dev(p, "class", "description");
    			add_location(p, file$4, 14, 4, 312);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*description*/ 2) set_data_dev(t, /*description*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(14:4) {#if description}",
    		ctx
    	});

    	return block;
    }

    // (19:2) {#each items as item (item.id)}
    function create_each_block$1(key_1, ctx) {
    	let first;
    	let menuitem;
    	let current;
    	const menuitem_spread_levels = [/*item*/ ctx[5]];
    	let menuitem_props = {};

    	for (let i = 0; i < menuitem_spread_levels.length; i += 1) {
    		menuitem_props = assign(menuitem_props, menuitem_spread_levels[i]);
    	}

    	menuitem = new MenuItem({ props: menuitem_props, $$inline: true });

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(menuitem.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(menuitem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const menuitem_changes = (dirty & /*items*/ 4)
    			? get_spread_update(menuitem_spread_levels, [get_spread_object(/*item*/ ctx[5])])
    			: {};

    			menuitem.$set(menuitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menuitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menuitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(menuitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(19:2) {#each items as item (item.id)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let section;
    	let div;
    	let h2;
    	let t0;
    	let t1;
    	let t2;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let current;
    	let if_block = /*description*/ ctx[1] && create_if_block$1(ctx);
    	let each_value = /*items*/ ctx[2];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*item*/ ctx[5].id;
    	validate_each_keys(ctx, each_value, get_each_context$1, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			section = element("section");
    			div = element("div");
    			h2 = element("h2");
    			t0 = text(/*name*/ ctx[0]);
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(h2, file$4, 12, 4, 270);
    			attr_dev(div, "class", "details svelte-glovo3");
    			add_location(div, file$4, 11, 2, 244);
    			attr_dev(section, "class", "menu-section svelte-glovo3");
    			add_location(section, file$4, 10, 0, 211);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div);
    			append_dev(div, h2);
    			append_dev(h2, t0);
    			append_dev(div, t1);
    			if (if_block) if_block.m(div, null);
    			append_dev(section, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(section, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*name*/ 1) set_data_dev(t0, /*name*/ ctx[0]);

    			if (/*description*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*items*/ 4) {
    				const each_value = /*items*/ ctx[2];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, section, outro_and_destroy_block, create_each_block$1, null, get_each_context$1);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (if_block) if_block.d();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { name = "Menu Section" } = $$props;
    	let { description = false } = $$props;
    	let { id = false } = $$props;
    	let { order = 1 } = $$props;
    	let { items = [] } = $$props;
    	const writable_props = ["name", "description", "id", "order", "items"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MenuSection> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("MenuSection", $$slots, []);

    	$$self.$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("description" in $$props) $$invalidate(1, description = $$props.description);
    		if ("id" in $$props) $$invalidate(3, id = $$props.id);
    		if ("order" in $$props) $$invalidate(4, order = $$props.order);
    		if ("items" in $$props) $$invalidate(2, items = $$props.items);
    	};

    	$$self.$capture_state = () => ({
    		MenuItem,
    		name,
    		description,
    		id,
    		order,
    		items
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("description" in $$props) $$invalidate(1, description = $$props.description);
    		if ("id" in $$props) $$invalidate(3, id = $$props.id);
    		if ("order" in $$props) $$invalidate(4, order = $$props.order);
    		if ("items" in $$props) $$invalidate(2, items = $$props.items);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name, description, items, id, order];
    }

    class MenuSection extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			name: 0,
    			description: 1,
    			id: 3,
    			order: 4,
    			items: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MenuSection",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get name() {
    		throw new Error("<MenuSection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<MenuSection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get description() {
    		throw new Error("<MenuSection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set description(value) {
    		throw new Error("<MenuSection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<MenuSection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<MenuSection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get order() {
    		throw new Error("<MenuSection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set order(value) {
    		throw new Error("<MenuSection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get items() {
    		throw new Error("<MenuSection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set items(value) {
    		throw new Error("<MenuSection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }
    function slide(node, { delay = 0, duration = 400, easing = cubicOut }) {
        const style = getComputedStyle(node);
        const opacity = +style.opacity;
        const height = parseFloat(style.height);
        const padding_top = parseFloat(style.paddingTop);
        const padding_bottom = parseFloat(style.paddingBottom);
        const margin_top = parseFloat(style.marginTop);
        const margin_bottom = parseFloat(style.marginBottom);
        const border_top_width = parseFloat(style.borderTopWidth);
        const border_bottom_width = parseFloat(style.borderBottomWidth);
        return {
            delay,
            duration,
            easing,
            css: t => `overflow: hidden;` +
                `opacity: ${Math.min(t * 20, 1) * opacity};` +
                `height: ${t * height}px;` +
                `padding-top: ${t * padding_top}px;` +
                `padding-bottom: ${t * padding_bottom}px;` +
                `margin-top: ${t * margin_top}px;` +
                `margin-bottom: ${t * margin_bottom}px;` +
                `border-top-width: ${t * border_top_width}px;` +
                `border-bottom-width: ${t * border_bottom_width}px;`
        };
    }

    /* src/order/OrderItem.svelte generated by Svelte v3.23.2 */
    const file$5 = "src/order/OrderItem.svelte";

    function create_fragment$5(ctx) {
    	let div2;
    	let div0;
    	let label;
    	let t0;
    	let label_for_value;
    	let t1;
    	let count_1;
    	let t2;
    	let div1;
    	let current;

    	count_1 = new Count({
    			props: {
    				count: /*count*/ ctx[0],
    				id: "order-count-" + /*id*/ ctx[1]
    			},
    			$$inline: true
    		});

    	count_1.$on("count", /*update*/ ctx[4]);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			label = element("label");
    			t0 = text(/*name*/ ctx[2]);
    			t1 = space();
    			create_component(count_1.$$.fragment);
    			t2 = space();
    			div1 = element("div");

    			div1.textContent = `
    £${/*total*/ ctx[3].toFixed(2)}`;

    			attr_dev(label, "for", label_for_value = "order-count-" + /*id*/ ctx[1]);
    			add_location(label, file$5, 20, 4, 434);
    			attr_dev(div0, "class", "details svelte-75h23h");
    			add_location(div0, file$5, 19, 2, 408);
    			attr_dev(div1, "class", "total svelte-75h23h");
    			add_location(div1, file$5, 23, 2, 549);
    			attr_dev(div2, "class", "order-item svelte-75h23h");
    			add_location(div2, file$5, 18, 0, 381);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, label);
    			append_dev(label, t0);
    			append_dev(div2, t1);
    			mount_component(count_1, div2, null);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*name*/ 4) set_data_dev(t0, /*name*/ ctx[2]);

    			if (!current || dirty & /*id*/ 2 && label_for_value !== (label_for_value = "order-count-" + /*id*/ ctx[1])) {
    				attr_dev(label, "for", label_for_value);
    			}

    			const count_1_changes = {};
    			if (dirty & /*count*/ 1) count_1_changes.count = /*count*/ ctx[0];
    			if (dirty & /*id*/ 2) count_1_changes.id = "order-count-" + /*id*/ ctx[1];
    			count_1.$set(count_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(count_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(count_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(count_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { id } = $$props;
    	let { name = "Order Item" } = $$props;
    	let { price = "0.00" } = $$props;
    	let { vat = true } = $$props;
    	let { count = 0 } = $$props;
    	let total = count * parseFloat(price);

    	function update(e) {
    		$$invalidate(0, count = e.detail);
    		orderList.addOrUpdate({ id, name, price, vat, count });
    	}

    	const writable_props = ["id", "name", "price", "vat", "count"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<OrderItem> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("OrderItem", $$slots, []);

    	$$self.$set = $$props => {
    		if ("id" in $$props) $$invalidate(1, id = $$props.id);
    		if ("name" in $$props) $$invalidate(2, name = $$props.name);
    		if ("price" in $$props) $$invalidate(5, price = $$props.price);
    		if ("vat" in $$props) $$invalidate(6, vat = $$props.vat);
    		if ("count" in $$props) $$invalidate(0, count = $$props.count);
    	};

    	$$self.$capture_state = () => ({
    		Count,
    		orderList,
    		id,
    		name,
    		price,
    		vat,
    		count,
    		total,
    		update
    	});

    	$$self.$inject_state = $$props => {
    		if ("id" in $$props) $$invalidate(1, id = $$props.id);
    		if ("name" in $$props) $$invalidate(2, name = $$props.name);
    		if ("price" in $$props) $$invalidate(5, price = $$props.price);
    		if ("vat" in $$props) $$invalidate(6, vat = $$props.vat);
    		if ("count" in $$props) $$invalidate(0, count = $$props.count);
    		if ("total" in $$props) $$invalidate(3, total = $$props.total);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [count, id, name, total, update, price, vat];
    }

    class OrderItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			id: 1,
    			name: 2,
    			price: 5,
    			vat: 6,
    			count: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "OrderItem",
    			options,
    			id: create_fragment$5.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*id*/ ctx[1] === undefined && !("id" in props)) {
    			console.warn("<OrderItem> was created without expected prop 'id'");
    		}
    	}

    	get id() {
    		throw new Error("<OrderItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<OrderItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get name() {
    		throw new Error("<OrderItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<OrderItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get price() {
    		throw new Error("<OrderItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set price(value) {
    		throw new Error("<OrderItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get vat() {
    		throw new Error("<OrderItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set vat(value) {
    		throw new Error("<OrderItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get count() {
    		throw new Error("<OrderItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set count(value) {
    		throw new Error("<OrderItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Review.svelte generated by Svelte v3.23.2 */
    const file$6 = "src/Review.svelte";

    // (9:0) {#if review}
    function create_if_block$2(ctx) {
    	let div0;
    	let div0_transition;
    	let t;
    	let div2;
    	let div1;
    	let div2_transition;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t = space();
    			div2 = element("div");
    			div1 = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div0, "class", "cover");
    			add_location(div0, file$6, 9, 0, 179);
    			attr_dev(div1, "class", "inner svelte-1rzr081");
    			add_location(div1, file$6, 12, 2, 296);
    			attr_dev(div2, "class", "review svelte-1rzr081");
    			add_location(div2, file$6, 11, 0, 256);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);

    			if (default_slot) {
    				default_slot.m(div1, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(div0, "click", /*click_handler*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 2) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[1], dirty, null, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div0_transition) div0_transition = create_bidirectional_transition(div0, fade, {}, true);
    				div0_transition.run(1);
    			});

    			transition_in(default_slot, local);

    			add_render_callback(() => {
    				if (!div2_transition) div2_transition = create_bidirectional_transition(div2, slide, {}, true);
    				div2_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div0_transition) div0_transition = create_bidirectional_transition(div0, fade, {}, false);
    			div0_transition.run(0);
    			transition_out(default_slot, local);
    			if (!div2_transition) div2_transition = create_bidirectional_transition(div2, slide, {}, false);
    			div2_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching && div0_transition) div0_transition.end();
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div2);
    			if (default_slot) default_slot.d(detaching);
    			if (detaching && div2_transition) div2_transition.end();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(9:0) {#if review}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*review*/ ctx[0] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*review*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*review*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { review = false } = $$props;
    	const writable_props = ["review"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Review> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Review", $$slots, ['default']);
    	const click_handler = () => $$invalidate(0, review = false);

    	$$self.$set = $$props => {
    		if ("review" in $$props) $$invalidate(0, review = $$props.review);
    		if ("$$scope" in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ fade, slide, review });

    	$$self.$inject_state = $$props => {
    		if ("review" in $$props) $$invalidate(0, review = $$props.review);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*review*/ 1) {
    			 document.body.style = review ? "overflow-y: hidden;" : "";
    		}
    	};

    	return [review, $$scope, $$slots, click_handler];
    }

    class Review extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { review: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Review",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get review() {
    		throw new Error("<Review>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set review(value) {
    		throw new Error("<Review>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/order/Order.svelte generated by Svelte v3.23.2 */

    const { console: console_1 } = globals;
    const file$7 = "src/order/Order.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[15] = list[i];
    	return child_ctx;
    }

    // (43:6) {#if !review}
    function create_if_block_1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Review and place order";
    			attr_dev(button, "class", "primary md");
    			add_location(button, file$7, 43, 6, 1185);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[8], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(43:6) {#if !review}",
    		ctx
    	});

    	return block;
    }

    // (59:4) {:else}
    function create_else_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Add something to your order to continue.";
    			add_location(p, file$7, 59, 4, 1551);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(59:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (57:4) {#each $orderList as item (item.id)}
    function create_each_block$2(key_1, ctx) {
    	let first;
    	let orderitem;
    	let current;
    	const orderitem_spread_levels = [/*item*/ ctx[15]];
    	let orderitem_props = {};

    	for (let i = 0; i < orderitem_spread_levels.length; i += 1) {
    		orderitem_props = assign(orderitem_props, orderitem_spread_levels[i]);
    	}

    	orderitem = new OrderItem({ props: orderitem_props, $$inline: true });

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(orderitem.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(orderitem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const orderitem_changes = (dirty & /*$orderList*/ 64)
    			? get_spread_update(orderitem_spread_levels, [get_spread_object(/*item*/ ctx[15])])
    			: {};

    			orderitem.$set(orderitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(orderitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(orderitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(orderitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(57:4) {#each $orderList as item (item.id)}",
    		ctx
    	});

    	return block;
    }

    // (52:0) <Review bind:review={review}>
    function create_default_slot(ctx) {
    	let div2;
    	let div0;
    	let h3;
    	let t0;
    	let t1;
    	let t2_value = /*total*/ ctx[1].toFixed(2) + "";
    	let t2;
    	let t3;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t4;
    	let div1;
    	let button0;
    	let t5;
    	let button0_disabled_value;
    	let t6;
    	let button1;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*$orderList*/ ctx[6];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*item*/ ctx[15].id;
    	validate_each_keys(ctx, each_value, get_each_context$2, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$2(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$2(key, child_ctx));
    	}

    	let each_1_else = null;

    	if (!each_value.length) {
    		each_1_else = create_else_block(ctx);
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			h3 = element("h3");
    			t0 = text(/*items*/ ctx[2]);
    			t1 = text(" Items - £");
    			t2 = text(t2_value);
    			t3 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (each_1_else) {
    				each_1_else.c();
    			}

    			t4 = space();
    			div1 = element("div");
    			button0 = element("button");
    			t5 = text("Place Order");
    			t6 = space();
    			button1 = element("button");
    			button1.textContent = "Back to Menu";
    			add_location(h3, file$7, 54, 6, 1410);
    			attr_dev(div0, "class", "details center");
    			add_location(div0, file$7, 53, 4, 1375);
    			attr_dev(button0, "class", "primary md svelte-j5wphm");
    			button0.disabled = button0_disabled_value = !/*$orderList*/ ctx[6].length || /*ordering*/ ctx[4];
    			add_location(button0, file$7, 62, 6, 1643);
    			attr_dev(button1, "class", "secondary md svelte-j5wphm");
    			add_location(button1, file$7, 65, 6, 1812);
    			attr_dev(div1, "class", "buttons svelte-j5wphm");
    			add_location(div1, file$7, 61, 4, 1615);
    			add_location(div2, file$7, 52, 2, 1365);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, h3);
    			append_dev(h3, t0);
    			append_dev(h3, t1);
    			append_dev(h3, t2);
    			append_dev(div2, t3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			if (each_1_else) {
    				each_1_else.m(div2, null);
    			}

    			append_dev(div2, t4);
    			append_dev(div2, div1);
    			append_dev(div1, button0);
    			append_dev(button0, t5);
    			append_dev(div1, t6);
    			append_dev(div1, button1);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler_1*/ ctx[10], false, false, false),
    					listen_dev(button0, "click", /*placeOrder*/ ctx[7], false, false, false),
    					listen_dev(button1, "click", /*click_handler_2*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*items*/ 4) set_data_dev(t0, /*items*/ ctx[2]);
    			if ((!current || dirty & /*total*/ 2) && t2_value !== (t2_value = /*total*/ ctx[1].toFixed(2) + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*$orderList*/ 64) {
    				const each_value = /*$orderList*/ ctx[6];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$2, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div2, outro_and_destroy_block, create_each_block$2, t4, get_each_context$2);
    				check_outros();

    				if (each_value.length) {
    					if (each_1_else) {
    						each_1_else.d(1);
    						each_1_else = null;
    					}
    				} else if (!each_1_else) {
    					each_1_else = create_else_block(ctx);
    					each_1_else.c();
    					each_1_else.m(div2, t4);
    				}
    			}

    			if (!current || dirty & /*$orderList, ordering*/ 80 && button0_disabled_value !== (button0_disabled_value = !/*$orderList*/ ctx[6].length || /*ordering*/ ctx[4])) {
    				prop_dev(button0, "disabled", button0_disabled_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (each_1_else) each_1_else.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(52:0) <Review bind:review={review}>",
    		ctx
    	});

    	return block;
    }

    // (73:0) {#if recieved}
    function create_if_block$3(ctx) {
    	let div0;
    	let div0_transition;
    	let t0;
    	let div2;
    	let h2;
    	let t2;
    	let p;
    	let t4;
    	let div1;
    	let button;
    	let div2_transition;
    	let current;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t0 = space();
    			div2 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Order recieved";
    			t2 = space();
    			p = element("p");
    			p.textContent = "We'll get that over to you as soon as we can.";
    			t4 = space();
    			div1 = element("div");
    			button = element("button");
    			button.textContent = "OK!";
    			attr_dev(div0, "class", "cover");
    			add_location(div0, file$7, 73, 0, 1959);
    			add_location(h2, file$7, 75, 2, 2074);
    			add_location(p, file$7, 76, 2, 2100);
    			attr_dev(button, "class", "primary md");
    			add_location(button, file$7, 78, 4, 2180);
    			attr_dev(div1, "class", "center");
    			add_location(div1, file$7, 77, 2, 2155);
    			attr_dev(div2, "class", "modal");
    			add_location(div2, file$7, 74, 0, 2037);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h2);
    			append_dev(div2, t2);
    			append_dev(div2, p);
    			append_dev(div2, t4);
    			append_dev(div2, div1);
    			append_dev(div1, button);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div0, "click", /*click_handler_3*/ ctx[13], false, false, false),
    					listen_dev(button, "click", /*click_handler_4*/ ctx[14], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div0_transition) div0_transition = create_bidirectional_transition(div0, fade, {}, true);
    				div0_transition.run(1);
    			});

    			add_render_callback(() => {
    				if (!div2_transition) div2_transition = create_bidirectional_transition(div2, fly, {}, true);
    				div2_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div0_transition) div0_transition = create_bidirectional_transition(div0, fade, {}, false);
    			div0_transition.run(0);
    			if (!div2_transition) div2_transition = create_bidirectional_transition(div2, fly, {}, false);
    			div2_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching && div0_transition) div0_transition.end();
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div2);
    			if (detaching && div2_transition) div2_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(73:0) {#if recieved}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let div2;
    	let div1;
    	let nav;
    	let div0;
    	let h3;
    	let t0;
    	let t1;
    	let t2_value = /*total*/ ctx[1].toFixed(2) + "";
    	let t2;
    	let t3;
    	let div2_resize_listener;
    	let t4;
    	let review_1;
    	let updating_review;
    	let t5;
    	let if_block1_anchor;
    	let current;
    	let if_block0 = !/*review*/ ctx[3] && create_if_block_1(ctx);

    	function review_1_review_binding(value) {
    		/*review_1_review_binding*/ ctx[12].call(null, value);
    	}

    	let review_1_props = {
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	};

    	if (/*review*/ ctx[3] !== void 0) {
    		review_1_props.review = /*review*/ ctx[3];
    	}

    	review_1 = new Review({ props: review_1_props, $$inline: true });
    	binding_callbacks.push(() => bind(review_1, "review", review_1_review_binding));
    	let if_block1 = /*recieved*/ ctx[5] && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			nav = element("nav");
    			div0 = element("div");
    			h3 = element("h3");
    			t0 = text(/*items*/ ctx[2]);
    			t1 = text(" Items - £");
    			t2 = text(t2_value);
    			t3 = space();
    			if (if_block0) if_block0.c();
    			t4 = space();
    			create_component(review_1.$$.fragment);
    			t5 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			add_location(h3, file$7, 40, 8, 1101);
    			attr_dev(div0, "class", "details");
    			add_location(div0, file$7, 39, 6, 1071);
    			add_location(nav, file$7, 38, 4, 1059);
    			attr_dev(div1, "class", "inner svelte-j5wphm");
    			add_location(div1, file$7, 37, 2, 1035);
    			attr_dev(div2, "class", "order svelte-j5wphm");
    			set_style(div2, "position", "fixed");
    			add_render_callback(() => /*div2_elementresize_handler*/ ctx[9].call(div2));
    			add_location(div2, file$7, 36, 0, 954);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, nav);
    			append_dev(nav, div0);
    			append_dev(div0, h3);
    			append_dev(h3, t0);
    			append_dev(h3, t1);
    			append_dev(h3, t2);
    			append_dev(nav, t3);
    			if (if_block0) if_block0.m(nav, null);
    			div2_resize_listener = add_resize_listener(div2, /*div2_elementresize_handler*/ ctx[9].bind(div2));
    			insert_dev(target, t4, anchor);
    			mount_component(review_1, target, anchor);
    			insert_dev(target, t5, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*items*/ 4) set_data_dev(t0, /*items*/ ctx[2]);
    			if ((!current || dirty & /*total*/ 2) && t2_value !== (t2_value = /*total*/ ctx[1].toFixed(2) + "")) set_data_dev(t2, t2_value);

    			if (!/*review*/ ctx[3]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					if_block0.m(nav, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			const review_1_changes = {};

    			if (dirty & /*$$scope, review, $orderList, ordering, total, items*/ 262238) {
    				review_1_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_review && dirty & /*review*/ 8) {
    				updating_review = true;
    				review_1_changes.review = /*review*/ ctx[3];
    				add_flush_callback(() => updating_review = false);
    			}

    			review_1.$set(review_1_changes);

    			if (/*recieved*/ ctx[5]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*recieved*/ 32) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block$3(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(review_1.$$.fragment, local);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(review_1.$$.fragment, local);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (if_block0) if_block0.d();
    			div2_resize_listener();
    			if (detaching) detach_dev(t4);
    			destroy_component(review_1, detaching);
    			if (detaching) detach_dev(t5);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let $orderList;
    	validate_store(orderList, "orderList");
    	component_subscribe($$self, orderList, $$value => $$invalidate(6, $orderList = $$value));
    	let { orderElHeight = 0 } = $$props;
    	let total = 0;
    	let items = 0;
    	let review = false;
    	let ordering = false;
    	let recieved = false;

    	function placeOrder() {
    		$$invalidate(4, ordering = true);

    		let order = $orderList.map(item => {
    			return { item: item.id, count: item.count };
    		});

    		console.log({ order });

    		post("order/", { order }).then(response => {
    			if (response.status === 204) {
    				orderList.set([]);
    				$$invalidate(3, review = false);
    				$$invalidate(5, recieved = true);
    			} else console.log(response);

    			$$invalidate(4, ordering = false);
    		});
    	}

    	const writable_props = ["orderElHeight"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Order> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Order", $$slots, []);
    	const click_handler = () => $$invalidate(3, review = true);

    	function div2_elementresize_handler() {
    		orderElHeight = this.offsetHeight;
    		$$invalidate(0, orderElHeight);
    	}

    	const click_handler_1 = () => $$invalidate(3, review = true);
    	const click_handler_2 = () => $$invalidate(3, review = false);

    	function review_1_review_binding(value) {
    		review = value;
    		$$invalidate(3, review);
    	}

    	const click_handler_3 = () => $$invalidate(5, recieved = false);
    	const click_handler_4 = () => $$invalidate(5, recieved = false);

    	$$self.$set = $$props => {
    		if ("orderElHeight" in $$props) $$invalidate(0, orderElHeight = $$props.orderElHeight);
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		fly,
    		OrderItem,
    		Review,
    		post,
    		orderList,
    		orderElHeight,
    		total,
    		items,
    		review,
    		ordering,
    		recieved,
    		placeOrder,
    		$orderList
    	});

    	$$self.$inject_state = $$props => {
    		if ("orderElHeight" in $$props) $$invalidate(0, orderElHeight = $$props.orderElHeight);
    		if ("total" in $$props) $$invalidate(1, total = $$props.total);
    		if ("items" in $$props) $$invalidate(2, items = $$props.items);
    		if ("review" in $$props) $$invalidate(3, review = $$props.review);
    		if ("ordering" in $$props) $$invalidate(4, ordering = $$props.ordering);
    		if ("recieved" in $$props) $$invalidate(5, recieved = $$props.recieved);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$orderList*/ 64) {
    			 {
    				$$invalidate(1, total = $orderList.reduce((acc, cur) => acc + parseFloat(cur.price) * cur.count, 0));
    				$$invalidate(2, items = $orderList.reduce((acc, cur) => acc + cur.count, 0));
    			}
    		}
    	};

    	return [
    		orderElHeight,
    		total,
    		items,
    		review,
    		ordering,
    		recieved,
    		$orderList,
    		placeOrder,
    		click_handler,
    		div2_elementresize_handler,
    		click_handler_1,
    		click_handler_2,
    		review_1_review_binding,
    		click_handler_3,
    		click_handler_4
    	];
    }

    class Order extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { orderElHeight: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Order",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get orderElHeight() {
    		throw new Error("<Order>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set orderElHeight(value) {
    		throw new Error("<Order>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/menu/Menu.svelte generated by Svelte v3.23.2 */
    const file$8 = "src/menu/Menu.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (20:2) {:catch error}
    function create_catch_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Oops something went wrong when trying to load the menu.";
    			add_location(p, file$8, 20, 2, 511);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(20:2) {:catch error}",
    		ctx
    	});

    	return block;
    }

    // (16:2) {:then sections}
    function create_then_block(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let current;
    	let each_value = /*sections*/ ctx[3];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*section*/ ctx[4].id;
    	validate_each_keys(ctx, each_value, get_each_context$3, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$3(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$3(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*menuItems*/ 2) {
    				const each_value = /*sections*/ ctx[3];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$3, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block$3, each_1_anchor, get_each_context$3);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block.name,
    		type: "then",
    		source: "(16:2) {:then sections}",
    		ctx
    	});

    	return block;
    }

    // (17:2) {#each sections as section (section.id)}
    function create_each_block$3(key_1, ctx) {
    	let first;
    	let menusection;
    	let current;
    	const menusection_spread_levels = [/*section*/ ctx[4]];
    	let menusection_props = {};

    	for (let i = 0; i < menusection_spread_levels.length; i += 1) {
    		menusection_props = assign(menusection_props, menusection_spread_levels[i]);
    	}

    	menusection = new MenuSection({ props: menusection_props, $$inline: true });

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(menusection.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(menusection, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const menusection_changes = (dirty & /*menuItems*/ 2)
    			? get_spread_update(menusection_spread_levels, [get_spread_object(/*section*/ ctx[4])])
    			: {};

    			menusection.$set(menusection_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menusection.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menusection.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(menusection, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(17:2) {#each sections as section (section.id)}",
    		ctx
    	});

    	return block;
    }

    // (14:20)    <p>Loading Menu</p>   {:then sections}
    function create_pending_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Loading Menu";
    			add_location(p, file$8, 14, 2, 369);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(14:20)    <p>Loading Menu</p>   {:then sections}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let article;
    	let h1;
    	let t1;
    	let promise;
    	let t2;
    	let order;
    	let updating_orderElHeight;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		value: 3,
    		error: 7,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*menuItems*/ ctx[1], info);

    	function order_orderElHeight_binding(value) {
    		/*order_orderElHeight_binding*/ ctx[2].call(null, value);
    	}

    	let order_props = {};

    	if (/*orderElHeight*/ ctx[0] !== void 0) {
    		order_props.orderElHeight = /*orderElHeight*/ ctx[0];
    	}

    	order = new Order({ props: order_props, $$inline: true });
    	binding_callbacks.push(() => bind(order, "orderElHeight", order_orderElHeight_binding));

    	const block = {
    		c: function create() {
    			article = element("article");
    			h1 = element("h1");
    			h1.textContent = "Menu";
    			t1 = space();
    			info.block.c();
    			t2 = space();
    			create_component(order.$$.fragment);
    			attr_dev(h1, "class", "svelte-1wdv9cp");
    			add_location(h1, file$8, 12, 2, 332);
    			set_style(article, "padding-bottom", /*orderElHeight*/ ctx[0] + "px");
    			add_location(article, file$8, 11, 0, 277);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, article, anchor);
    			append_dev(article, h1);
    			append_dev(article, t1);
    			info.block.m(article, info.anchor = null);
    			info.mount = () => article;
    			info.anchor = null;
    			insert_dev(target, t2, anchor);
    			mount_component(order, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			{
    				const child_ctx = ctx.slice();
    				child_ctx[3] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}

    			if (!current || dirty & /*orderElHeight*/ 1) {
    				set_style(article, "padding-bottom", /*orderElHeight*/ ctx[0] + "px");
    			}

    			const order_changes = {};

    			if (!updating_orderElHeight && dirty & /*orderElHeight*/ 1) {
    				updating_orderElHeight = true;
    				order_changes.orderElHeight = /*orderElHeight*/ ctx[0];
    				add_flush_callback(() => updating_orderElHeight = false);
    			}

    			order.$set(order_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(info.block);
    			transition_in(order.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			transition_out(order.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(article);
    			info.block.d();
    			info.token = null;
    			info = null;
    			if (detaching) detach_dev(t2);
    			destroy_component(order, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let orderElHeight;
    	let menuItems = fetch("/menu/").then(response => response.json()).then(data => data.sections);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Menu> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Menu", $$slots, []);

    	function order_orderElHeight_binding(value) {
    		orderElHeight = value;
    		$$invalidate(0, orderElHeight);
    	}

    	$$self.$capture_state = () => ({
    		MenuSection,
    		Order,
    		orderElHeight,
    		menuItems
    	});

    	$$self.$inject_state = $$props => {
    		if ("orderElHeight" in $$props) $$invalidate(0, orderElHeight = $$props.orderElHeight);
    		if ("menuItems" in $$props) $$invalidate(1, menuItems = $$props.menuItems);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [orderElHeight, menuItems, order_orderElHeight_binding];
    }

    class Menu extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Menu",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/dashboard/OrderList.svelte generated by Svelte v3.23.2 */
    const file$9 = "src/dashboard/OrderList.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    // (12:6) {#if order.paid}
    function create_if_block$4(ctx) {
    	let t0;
    	let span;

    	const block = {
    		c: function create() {
    			t0 = text("- ");
    			span = element("span");
    			span.textContent = "PAID";
    			attr_dev(span, "class", "svelte-mfm72q");
    			add_location(span, file$9, 11, 25, 315);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(12:6) {#if order.paid}",
    		ctx
    	});

    	return block;
    }

    // (8:0) {#each orders as order (order.id)}
    function create_each_block$4(key_1, ctx) {
    	let div3;
    	let div0;
    	let span0;
    	let t0_value = /*order*/ ctx[3].group + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2_value = /*order*/ ctx[3].no_items + "";
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let div1;
    	let t6;
    	let t7_value = /*order*/ ctx[3].total + "";
    	let t7;
    	let t8;
    	let div2;
    	let button;
    	let t10;
    	let mounted;
    	let dispose;
    	let if_block = /*order*/ ctx[3].paid && create_if_block$4(ctx);

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[2](/*order*/ ctx[3], ...args);
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = text(" - ");
    			span1 = element("span");
    			t2 = text(t2_value);
    			t3 = text(" items");
    			t4 = space();
    			if (if_block) if_block.c();
    			t5 = space();
    			div1 = element("div");
    			t6 = text("£");
    			t7 = text(t7_value);
    			t8 = space();
    			div2 = element("div");
    			button = element("button");
    			button.textContent = "View";
    			t10 = space();
    			attr_dev(span0, "class", "svelte-mfm72q");
    			add_location(span0, file$9, 10, 6, 225);
    			attr_dev(span1, "class", "svelte-mfm72q");
    			add_location(span1, file$9, 10, 35, 254);
    			attr_dev(div0, "class", "details svelte-mfm72q");
    			add_location(div0, file$9, 9, 4, 197);
    			attr_dev(div1, "class", "total svelte-mfm72q");
    			add_location(div1, file$9, 13, 4, 353);
    			attr_dev(button, "class", "primary md svelte-mfm72q");
    			add_location(button, file$9, 17, 6, 421);
    			add_location(div2, file$9, 16, 4, 409);
    			attr_dev(div3, "class", "order svelte-mfm72q");
    			add_location(div3, file$9, 8, 2, 173);
    			this.first = div3;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, span0);
    			append_dev(span0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, span1);
    			append_dev(span1, t2);
    			append_dev(span1, t3);
    			append_dev(div0, t4);
    			if (if_block) if_block.m(div0, null);
    			append_dev(div3, t5);
    			append_dev(div3, div1);
    			append_dev(div1, t6);
    			append_dev(div1, t7);
    			append_dev(div3, t8);
    			append_dev(div3, div2);
    			append_dev(div2, button);
    			append_dev(div3, t10);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*orders*/ 1 && t0_value !== (t0_value = /*order*/ ctx[3].group + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*orders*/ 1 && t2_value !== (t2_value = /*order*/ ctx[3].no_items + "")) set_data_dev(t2, t2_value);

    			if (/*order*/ ctx[3].paid) {
    				if (if_block) ; else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*orders*/ 1 && t7_value !== (t7_value = /*order*/ ctx[3].total + "")) set_data_dev(t7, t7_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(8:0) {#each orders as order (order.id)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let each_value = /*orders*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*order*/ ctx[3].id;
    	validate_each_keys(ctx, each_value, get_each_context$4, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$4(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$4(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*dispatch, orders*/ 3) {
    				const each_value = /*orders*/ ctx[0];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$4, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, destroy_block, create_each_block$4, each_1_anchor, get_each_context$4);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { orders } = $$props;
    	const dispatch = createEventDispatcher();
    	const writable_props = ["orders"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<OrderList> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("OrderList", $$slots, []);
    	const click_handler = order => dispatch("editorder", order);

    	$$self.$set = $$props => {
    		if ("orders" in $$props) $$invalidate(0, orders = $$props.orders);
    	};

    	$$self.$capture_state = () => ({ createEventDispatcher, orders, dispatch });

    	$$self.$inject_state = $$props => {
    		if ("orders" in $$props) $$invalidate(0, orders = $$props.orders);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [orders, dispatch, click_handler];
    }

    class OrderList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { orders: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "OrderList",
    			options,
    			id: create_fragment$9.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*orders*/ ctx[0] === undefined && !("orders" in props)) {
    			console.warn("<OrderList> was created without expected prop 'orders'");
    		}
    	}

    	get orders() {
    		throw new Error("<OrderList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set orders(value) {
    		throw new Error("<OrderList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/order/OrderReview.svelte generated by Svelte v3.23.2 */

    const file$a = "src/order/OrderReview.svelte";

    function get_each_context$5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	child_ctx[5] = i;
    	return child_ctx;
    }

    // (14:2) {#each order.order_items as item, i (i)}
    function create_each_block$5(key_1, ctx) {
    	let div3;
    	let div0;
    	let t0_value = /*item*/ ctx[3].item_name + "";
    	let t0;
    	let t1;
    	let div1;
    	let t2_value = /*item*/ ctx[3].count + "";
    	let t2;
    	let t3;
    	let div2;
    	let t4;
    	let t5_value = /*item*/ ctx[3].total + "";
    	let t5;
    	let t6;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			t4 = text("£");
    			t5 = text(t5_value);
    			t6 = space();
    			attr_dev(div0, "class", "item svelte-mvicdp");
    			add_location(div0, file$a, 15, 4, 414);
    			attr_dev(div1, "class", "count");
    			add_location(div1, file$a, 18, 4, 471);
    			attr_dev(div2, "class", "total svelte-mvicdp");
    			add_location(div2, file$a, 21, 4, 525);
    			attr_dev(div3, "class", "item-row svelte-mvicdp");
    			add_location(div3, file$a, 14, 2, 387);
    			this.first = div3;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, t0);
    			append_dev(div3, t1);
    			append_dev(div3, div1);
    			append_dev(div1, t2);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div2, t4);
    			append_dev(div2, t5);
    			append_dev(div3, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*order*/ 1 && t0_value !== (t0_value = /*item*/ ctx[3].item_name + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*order*/ 1 && t2_value !== (t2_value = /*item*/ ctx[3].count + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*order*/ 1 && t5_value !== (t5_value = /*item*/ ctx[3].total + "")) set_data_dev(t5, t5_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$5.name,
    		type: "each",
    		source: "(14:2) {#each order.order_items as item, i (i)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let div0;
    	let h2;
    	let t0_value = /*order*/ ctx[0].group + "";
    	let t0;
    	let t1;
    	let h3;
    	let t2_value = /*order*/ ctx[0].no_items + "";
    	let t2;
    	let t3;
    	let t4_value = (/*order*/ ctx[0].no_items > 1 ? "s" : "") + "";
    	let t4;
    	let t5;
    	let t6_value = /*order*/ ctx[0].total + "";
    	let t6;
    	let t7_value = (/*order*/ ctx[0].paid ? " - PAID" : "") + "";
    	let t7;
    	let t8;
    	let h4;
    	let t12;
    	let div1;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t13;
    	let div8;
    	let div4;
    	let div2;
    	let t15;
    	let div3;
    	let t16;
    	let t17_value = /*order*/ ctx[0].total + "";
    	let t17;
    	let t18;
    	let div7;
    	let div5;
    	let t20;
    	let div6;
    	let t21;
    	let t22_value = /*order*/ ctx[0].vat_total + "";
    	let t22;
    	let each_value = /*order*/ ctx[0].order_items;
    	validate_each_argument(each_value);
    	const get_key = ctx => /*i*/ ctx[5];
    	validate_each_keys(ctx, each_value, get_each_context$5, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$5(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$5(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h2 = element("h2");
    			t0 = text(t0_value);
    			t1 = space();
    			h3 = element("h3");
    			t2 = text(t2_value);
    			t3 = text(" item");
    			t4 = text(t4_value);
    			t5 = text(" - £");
    			t6 = text(t6_value);
    			t7 = text(t7_value);
    			t8 = space();
    			h4 = element("h4");
    			h4.textContent = `${/*time*/ ctx[2]} - ${/*date*/ ctx[1]}`;
    			t12 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t13 = space();
    			div8 = element("div");
    			div4 = element("div");
    			div2 = element("div");
    			div2.textContent = "Total:";
    			t15 = space();
    			div3 = element("div");
    			t16 = text("£");
    			t17 = text(t17_value);
    			t18 = space();
    			div7 = element("div");
    			div5 = element("div");
    			div5.textContent = "inc VAT";
    			t20 = space();
    			div6 = element("div");
    			t21 = text("£");
    			t22 = text(t22_value);
    			add_location(h2, file$a, 8, 0, 152);
    			add_location(h3, file$a, 9, 0, 175);
    			add_location(h4, file$a, 10, 0, 283);
    			attr_dev(div0, "class", "center");
    			add_location(div0, file$a, 7, 0, 131);
    			attr_dev(div1, "class", "reciept-list");
    			add_location(div1, file$a, 12, 0, 315);
    			attr_dev(div2, "class", "item svelte-mvicdp");
    			add_location(div2, file$a, 29, 4, 660);
    			attr_dev(div3, "class", "total svelte-mvicdp");
    			add_location(div3, file$a, 32, 4, 707);
    			attr_dev(div4, "class", "item-row svelte-mvicdp");
    			add_location(div4, file$a, 28, 2, 633);
    			attr_dev(div5, "class", "item svelte-mvicdp");
    			add_location(div5, file$a, 37, 4, 797);
    			attr_dev(div6, "class", "total svelte-mvicdp");
    			add_location(div6, file$a, 40, 4, 845);
    			attr_dev(div7, "class", "item-row svelte-mvicdp");
    			add_location(div7, file$a, 36, 2, 770);
    			attr_dev(div8, "class", "reciept-totals");
    			add_location(div8, file$a, 27, 0, 602);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h2);
    			append_dev(h2, t0);
    			append_dev(div0, t1);
    			append_dev(div0, h3);
    			append_dev(h3, t2);
    			append_dev(h3, t3);
    			append_dev(h3, t4);
    			append_dev(h3, t5);
    			append_dev(h3, t6);
    			append_dev(h3, t7);
    			append_dev(div0, t8);
    			append_dev(div0, h4);
    			insert_dev(target, t12, anchor);
    			insert_dev(target, div1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			insert_dev(target, t13, anchor);
    			insert_dev(target, div8, anchor);
    			append_dev(div8, div4);
    			append_dev(div4, div2);
    			append_dev(div4, t15);
    			append_dev(div4, div3);
    			append_dev(div3, t16);
    			append_dev(div3, t17);
    			append_dev(div8, t18);
    			append_dev(div8, div7);
    			append_dev(div7, div5);
    			append_dev(div7, t20);
    			append_dev(div7, div6);
    			append_dev(div6, t21);
    			append_dev(div6, t22);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*order*/ 1 && t0_value !== (t0_value = /*order*/ ctx[0].group + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*order*/ 1 && t2_value !== (t2_value = /*order*/ ctx[0].no_items + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*order*/ 1 && t4_value !== (t4_value = (/*order*/ ctx[0].no_items > 1 ? "s" : "") + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*order*/ 1 && t6_value !== (t6_value = /*order*/ ctx[0].total + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*order*/ 1 && t7_value !== (t7_value = (/*order*/ ctx[0].paid ? " - PAID" : "") + "")) set_data_dev(t7, t7_value);

    			if (dirty & /*order*/ 1) {
    				const each_value = /*order*/ ctx[0].order_items;
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$5, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div1, destroy_block, create_each_block$5, null, get_each_context$5);
    			}

    			if (dirty & /*order*/ 1 && t17_value !== (t17_value = /*order*/ ctx[0].total + "")) set_data_dev(t17, t17_value);
    			if (dirty & /*order*/ 1 && t22_value !== (t22_value = /*order*/ ctx[0].vat_total + "")) set_data_dev(t22, t22_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t12);
    			if (detaching) detach_dev(div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(div8);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { order } = $$props;
    	let date = order.time.split("T")[0];
    	let time = order.time.split("T")[1].slice(0, 8);
    	const writable_props = ["order"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<OrderReview> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("OrderReview", $$slots, []);

    	$$self.$set = $$props => {
    		if ("order" in $$props) $$invalidate(0, order = $$props.order);
    	};

    	$$self.$capture_state = () => ({ order, date, time });

    	$$self.$inject_state = $$props => {
    		if ("order" in $$props) $$invalidate(0, order = $$props.order);
    		if ("date" in $$props) $$invalidate(1, date = $$props.date);
    		if ("time" in $$props) $$invalidate(2, time = $$props.time);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [order, date, time];
    }

    class OrderReview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { order: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "OrderReview",
    			options,
    			id: create_fragment$a.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*order*/ ctx[0] === undefined && !("order" in props)) {
    			console.warn("<OrderReview> was created without expected prop 'order'");
    		}
    	}

    	get order() {
    		throw new Error("<OrderReview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set order(value) {
    		throw new Error("<OrderReview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/dashboard/DailyOrders.svelte generated by Svelte v3.23.2 */

    const { console: console_1$1 } = globals;
    const file$b = "src/dashboard/DailyOrders.svelte";

    // (73:2) {:catch error}
    function create_catch_block$1(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Oops something went wrong when trying to load today's orders!";
    			add_location(p, file$b, 73, 2, 2256);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block$1.name,
    		type: "catch",
    		source: "(73:2) {:catch error}",
    		ctx
    	});

    	return block;
    }

    // (52:2) {:then orders}
    function create_then_block$1(ctx) {
    	let div0;
    	let h30;
    	let t1;
    	let p0;
    	let t3;
    	let orderlist0;
    	let t4;
    	let div1;
    	let h31;
    	let t6;
    	let p1;
    	let t8;
    	let orderlist1;
    	let t9;
    	let div2;
    	let h32;
    	let t11;
    	let p2;
    	let t13;
    	let orderlist2;
    	let t14;
    	let div3;
    	let h33;
    	let t16;
    	let p3;
    	let t18;
    	let orderlist3;
    	let current;

    	orderlist0 = new OrderList({
    			props: { orders: /*orders*/ ctx[10].filter(func) },
    			$$inline: true
    		});

    	orderlist0.$on("editorder", /*editOrder*/ ctx[3]);

    	orderlist1 = new OrderList({
    			props: {
    				orders: /*orders*/ ctx[10].filter(func_1)
    			},
    			$$inline: true
    		});

    	orderlist1.$on("editorder", /*editOrder*/ ctx[3]);

    	orderlist2 = new OrderList({
    			props: {
    				orders: /*orders*/ ctx[10].filter(func_2)
    			},
    			$$inline: true
    		});

    	orderlist2.$on("editorder", /*editOrder*/ ctx[3]);

    	orderlist3 = new OrderList({
    			props: {
    				orders: /*orders*/ ctx[10].filter(func_3)
    			},
    			$$inline: true
    		});

    	orderlist3.$on("editorder", /*editOrder*/ ctx[3]);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Pending";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "These orders haven't been sarted yet";
    			t3 = space();
    			create_component(orderlist0.$$.fragment);
    			t4 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Accepted";
    			t6 = space();
    			p1 = element("p");
    			p1.textContent = "These orders are being worked on";
    			t8 = space();
    			create_component(orderlist1.$$.fragment);
    			t9 = space();
    			div2 = element("div");
    			h32 = element("h3");
    			h32.textContent = "Completed";
    			t11 = space();
    			p2 = element("p");
    			p2.textContent = "These orders have been served, but not paid";
    			t13 = space();
    			create_component(orderlist2.$$.fragment);
    			t14 = space();
    			div3 = element("div");
    			h33 = element("h3");
    			h33.textContent = "Paid";
    			t16 = space();
    			p3 = element("p");
    			p3.textContent = "These orders have been completed and paid";
    			t18 = space();
    			create_component(orderlist3.$$.fragment);
    			add_location(h30, file$b, 53, 4, 1365);
    			attr_dev(p0, "class", "details svelte-1iwfgnh");
    			add_location(p0, file$b, 54, 4, 1386);
    			attr_dev(div0, "class", "section");
    			add_location(div0, file$b, 52, 2, 1339);
    			add_location(h31, file$b, 58, 4, 1576);
    			attr_dev(p1, "class", "details svelte-1iwfgnh");
    			add_location(p1, file$b, 59, 4, 1598);
    			attr_dev(div1, "class", "section");
    			add_location(div1, file$b, 57, 2, 1550);
    			add_location(h32, file$b, 63, 4, 1803);
    			attr_dev(p2, "class", "details svelte-1iwfgnh");
    			add_location(p2, file$b, 64, 4, 1826);
    			attr_dev(div2, "class", "section");
    			add_location(div2, file$b, 62, 2, 1777);
    			add_location(h33, file$b, 68, 4, 2038);
    			attr_dev(p3, "class", "details svelte-1iwfgnh");
    			add_location(p3, file$b, 69, 4, 2056);
    			attr_dev(div3, "class", "section");
    			add_location(div3, file$b, 67, 2, 2012);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h30);
    			append_dev(div0, t1);
    			append_dev(div0, p0);
    			append_dev(div0, t3);
    			mount_component(orderlist0, div0, null);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h31);
    			append_dev(div1, t6);
    			append_dev(div1, p1);
    			append_dev(div1, t8);
    			mount_component(orderlist1, div1, null);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h32);
    			append_dev(div2, t11);
    			append_dev(div2, p2);
    			append_dev(div2, t13);
    			mount_component(orderlist2, div2, null);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h33);
    			append_dev(div3, t16);
    			append_dev(div3, p3);
    			append_dev(div3, t18);
    			mount_component(orderlist3, div3, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const orderlist0_changes = {};
    			if (dirty & /*todaysOrders*/ 4) orderlist0_changes.orders = /*orders*/ ctx[10].filter(func);
    			orderlist0.$set(orderlist0_changes);
    			const orderlist1_changes = {};
    			if (dirty & /*todaysOrders*/ 4) orderlist1_changes.orders = /*orders*/ ctx[10].filter(func_1);
    			orderlist1.$set(orderlist1_changes);
    			const orderlist2_changes = {};
    			if (dirty & /*todaysOrders*/ 4) orderlist2_changes.orders = /*orders*/ ctx[10].filter(func_2);
    			orderlist2.$set(orderlist2_changes);
    			const orderlist3_changes = {};
    			if (dirty & /*todaysOrders*/ 4) orderlist3_changes.orders = /*orders*/ ctx[10].filter(func_3);
    			orderlist3.$set(orderlist3_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(orderlist0.$$.fragment, local);
    			transition_in(orderlist1.$$.fragment, local);
    			transition_in(orderlist2.$$.fragment, local);
    			transition_in(orderlist3.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(orderlist0.$$.fragment, local);
    			transition_out(orderlist1.$$.fragment, local);
    			transition_out(orderlist2.$$.fragment, local);
    			transition_out(orderlist3.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			destroy_component(orderlist0);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div1);
    			destroy_component(orderlist1);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(div2);
    			destroy_component(orderlist2);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(div3);
    			destroy_component(orderlist3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block$1.name,
    		type: "then",
    		source: "(52:2) {:then orders}",
    		ctx
    	});

    	return block;
    }

    // (50:23)    <p>Loading Orders</p>   {:then orders}
    function create_pending_block$1(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Loading Orders";
    			add_location(p, file$b, 50, 2, 1298);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block$1.name,
    		type: "pending",
    		source: "(50:23)    <p>Loading Orders</p>   {:then orders}",
    		ctx
    	});

    	return block;
    }

    // (85:36) 
    function create_if_block_2(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Completed");
    			attr_dev(button, "class", "primary md svelte-1iwfgnh");
    			button.disabled = /*sending*/ ctx[1];
    			add_location(button, file$b, 85, 8, 2666);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_1*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sending*/ 2) {
    				prop_dev(button, "disabled", /*sending*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(85:36) ",
    		ctx
    	});

    	return block;
    }

    // (83:8) {#if !review.accepted}
    function create_if_block_1$1(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Accepted");
    			attr_dev(button, "class", "primary md svelte-1iwfgnh");
    			button.disabled = /*sending*/ ctx[1];
    			add_location(button, file$b, 83, 8, 2510);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sending*/ 2) {
    				prop_dev(button, "disabled", /*sending*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(83:8) {#if !review.accepted}",
    		ctx
    	});

    	return block;
    }

    // (88:8) {#if !review.paid}
    function create_if_block$5(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Paid");
    			attr_dev(button, "class", "primary md svelte-1iwfgnh");
    			button.disabled = /*sending*/ ctx[1];
    			add_location(button, file$b, 88, 8, 2828);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_2*/ ctx[7], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sending*/ 2) {
    				prop_dev(button, "disabled", /*sending*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(88:8) {#if !review.paid}",
    		ctx
    	});

    	return block;
    }

    // (78:0) <Review bind:review={review}>
    function create_default_slot$1(ctx) {
    	let div3;
    	let div1;
    	let orderreview;
    	let t0;
    	let div0;
    	let t1;
    	let t2;
    	let div2;
    	let button;
    	let current;
    	let mounted;
    	let dispose;

    	orderreview = new OrderReview({
    			props: { order: /*review*/ ctx[0] },
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (!/*review*/ ctx[0].accepted) return create_if_block_1$1;
    		if (!/*review*/ ctx[0].completed) return create_if_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);
    	let if_block1 = !/*review*/ ctx[0].paid && create_if_block$5(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div1 = element("div");
    			create_component(orderreview.$$.fragment);
    			t0 = space();
    			div0 = element("div");
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			div2 = element("div");
    			button = element("button");
    			button.textContent = "Back to orders";
    			attr_dev(div0, "class", "buttons svelte-1iwfgnh");
    			add_location(div0, file$b, 81, 6, 2449);
    			add_location(div1, file$b, 79, 4, 2400);
    			attr_dev(button, "class", "secondary md svelte-1iwfgnh");
    			add_location(button, file$b, 93, 6, 2998);
    			attr_dev(div2, "class", "back svelte-1iwfgnh");
    			add_location(div2, file$b, 92, 4, 2973);
    			attr_dev(div3, "class", "inner svelte-1iwfgnh");
    			add_location(div3, file$b, 78, 2, 2376);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div1);
    			mount_component(orderreview, div1, null);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			if (if_block0) if_block0.m(div0, null);
    			append_dev(div0, t1);
    			if (if_block1) if_block1.m(div0, null);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div2, button);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_3*/ ctx[8], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const orderreview_changes = {};
    			if (dirty & /*review*/ 1) orderreview_changes.order = /*review*/ ctx[0];
    			orderreview.$set(orderreview_changes);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div0, t1);
    				}
    			}

    			if (!/*review*/ ctx[0].paid) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$5(ctx);
    					if_block1.c();
    					if_block1.m(div0, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(orderreview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(orderreview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			destroy_component(orderreview);

    			if (if_block0) {
    				if_block0.d();
    			}

    			if (if_block1) if_block1.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(78:0) <Review bind:review={review}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let h2;
    	let t1;
    	let div;
    	let promise;
    	let t2;
    	let review_1;
    	let updating_review;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		pending: create_pending_block$1,
    		then: create_then_block$1,
    		catch: create_catch_block$1,
    		value: 10,
    		error: 11,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*todaysOrders*/ ctx[2], info);

    	function review_1_review_binding(value) {
    		/*review_1_review_binding*/ ctx[9].call(null, value);
    	}

    	let review_1_props = {
    		$$slots: { default: [create_default_slot$1] },
    		$$scope: { ctx }
    	};

    	if (/*review*/ ctx[0] !== void 0) {
    		review_1_props.review = /*review*/ ctx[0];
    	}

    	review_1 = new Review({ props: review_1_props, $$inline: true });
    	binding_callbacks.push(() => bind(review_1, "review", review_1_review_binding));

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Today's Orders";
    			t1 = space();
    			div = element("div");
    			info.block.c();
    			t2 = space();
    			create_component(review_1.$$.fragment);
    			add_location(h2, file$b, 47, 0, 1242);
    			add_location(div, file$b, 48, 0, 1266);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			info.block.m(div, info.anchor = null);
    			info.mount = () => div;
    			info.anchor = null;
    			insert_dev(target, t2, anchor);
    			mount_component(review_1, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*todaysOrders*/ 4 && promise !== (promise = /*todaysOrders*/ ctx[2]) && handle_promise(promise, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[10] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}

    			const review_1_changes = {};

    			if (dirty & /*$$scope, review, sending*/ 4099) {
    				review_1_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_review && dirty & /*review*/ 1) {
    				updating_review = true;
    				review_1_changes.review = /*review*/ ctx[0];
    				add_flush_callback(() => updating_review = false);
    			}

    			review_1.$set(review_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(info.block);
    			transition_in(review_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			transition_out(review_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			info.block.d();
    			info.token = null;
    			info = null;
    			if (detaching) detach_dev(t2);
    			destroy_component(review_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func = order => !order.accepted;
    const func_1 = order => order.accepted && !order.completed;
    const func_2 = order => order.completed && !order.paid;
    const func_3 = order => order.completed && order.paid;

    function instance$b($$self, $$props, $$invalidate) {
    	let review = false;
    	let sending = false;
    	let todaysOrders = fetch("/orders/").then(toData).then(data => data.orders);

    	function editOrder(e) {
    		$$invalidate(0, review = e.detail);
    	}

    	function sendUpdateOrder(flag) {
    		$$invalidate(1, sending = true);
    		let data = {};
    		data[flag] = true;

    		patch(`/orders/${review.id}/`, data).then(response => {
    			if (response.status === 200) {
    				return response.json();
    			}
    		}).then(updatedOrder => {
    			todaysOrders.then(currentOrders => {
    				const updatedOrderIndex = currentOrders.findIndex(order => order.id === updatedOrder.id);
    				if (updatedOrderIndex >= 0) currentOrders[updatedOrderIndex] = updatedOrder;
    				$$invalidate(1, sending = false);
    				console.log(currentOrders);
    				return currentOrders;
    			});

    			$$invalidate(2, todaysOrders);
    			$$invalidate(0, review = updatedOrder);
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<DailyOrders> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("DailyOrders", $$slots, []);
    	const click_handler = () => sendUpdateOrder("accepted");
    	const click_handler_1 = () => sendUpdateOrder("completed");
    	const click_handler_2 = () => sendUpdateOrder("paid");
    	const click_handler_3 = () => $$invalidate(0, review = false);

    	function review_1_review_binding(value) {
    		review = value;
    		$$invalidate(0, review);
    	}

    	$$self.$capture_state = () => ({
    		Review,
    		OrderList,
    		OrderReview,
    		patch,
    		toData,
    		review,
    		sending,
    		todaysOrders,
    		editOrder,
    		sendUpdateOrder
    	});

    	$$self.$inject_state = $$props => {
    		if ("review" in $$props) $$invalidate(0, review = $$props.review);
    		if ("sending" in $$props) $$invalidate(1, sending = $$props.sending);
    		if ("todaysOrders" in $$props) $$invalidate(2, todaysOrders = $$props.todaysOrders);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*review*/ 1) {
    			 {
    				if (review) document.body.style = "overflow: hidden;"; else document.body.style = "";
    			}
    		}
    	};

    	return [
    		review,
    		sending,
    		todaysOrders,
    		editOrder,
    		sendUpdateOrder,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		review_1_review_binding
    	];
    }

    class DailyOrders extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DailyOrders",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    /* src/dashboard/TableUpdate.svelte generated by Svelte v3.23.2 */
    const file$c = "src/dashboard/TableUpdate.svelte";

    // (72:2) {:else}
    function create_else_block_1(ctx) {
    	let h3;
    	let t0;
    	let t1_value = /*table*/ ctx[0].name + "";
    	let t1;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			t0 = text("Table ");
    			t1 = text(t1_value);
    			attr_dev(h3, "class", "svelte-1xb9kxf");
    			add_location(h3, file$c, 72, 2, 1872);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, t0);
    			append_dev(h3, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*table*/ 1 && t1_value !== (t1_value = /*table*/ ctx[0].name + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(72:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (70:2) {#if !table.id}
    function create_if_block_1$2(ctx) {
    	let h3;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "New Table";
    			attr_dev(h3, "class", "svelte-1xb9kxf");
    			add_location(h3, file$c, 70, 2, 1841);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(70:2) {#if !table.id}",
    		ctx
    	});

    	return block;
    }

    // (87:4) {:else}
    function create_else_block$1(ctx) {
    	let button0;
    	let t0;
    	let t1;
    	let button1;
    	let t3;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			t0 = text("Rename Table");
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Delete Table";
    			t3 = space();
    			img = element("img");
    			attr_dev(button0, "class", "primary md");
    			button0.disabled = /*sending*/ ctx[1];
    			add_location(button0, file$c, 87, 4, 2348);
    			attr_dev(button1, "class", "secondary md");
    			add_location(button1, file$c, 88, 4, 2438);
    			if (img.src !== (img_src_value = /*table*/ ctx[0].img)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*table*/ ctx[0].url);
    			attr_dev(img, "class", "svelte-1xb9kxf");
    			add_location(img, file$c, 89, 4, 2513);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);
    			append_dev(button0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*update*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*delTable*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sending*/ 2) {
    				prop_dev(button0, "disabled", /*sending*/ ctx[1]);
    			}

    			if (dirty & /*table*/ 1 && img.src !== (img_src_value = /*table*/ ctx[0].img)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*table*/ 1 && img_alt_value !== (img_alt_value = /*table*/ ctx[0].url)) {
    				attr_dev(img, "alt", img_alt_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(87:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (85:4) {#if !table.id}
    function create_if_block$6(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Add Table");
    			attr_dev(button, "class", "primary md");
    			button.disabled = /*sending*/ ctx[1];
    			add_location(button, file$c, 85, 4, 2252);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*add*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sending*/ 2) {
    				prop_dev(button, "disabled", /*sending*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(85:4) {#if !table.id}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
    	let div2;
    	let t0;
    	let form;
    	let label;
    	let t2;
    	let div0;
    	let input;
    	let t3;
    	let p;
    	let t4;
    	let t5;
    	let div1;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (!/*table*/ ctx[0].id) return create_if_block_1$2;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (!/*table*/ ctx[0].id) return create_if_block$6;
    		return create_else_block$1;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			if_block0.c();
    			t0 = space();
    			form = element("form");
    			label = element("label");
    			label.textContent = "Table name:";
    			t2 = space();
    			div0 = element("div");
    			input = element("input");
    			t3 = space();
    			p = element("p");
    			t4 = text(/*error*/ ctx[2]);
    			t5 = space();
    			div1 = element("div");
    			if_block1.c();
    			attr_dev(label, "for", "name");
    			attr_dev(label, "class", "svelte-1xb9kxf");
    			add_location(label, file$c, 75, 4, 1955);
    			attr_dev(input, "id", "name");
    			attr_dev(input, "type", "text");
    			input.required = true;
    			attr_dev(input, "class", "svelte-1xb9kxf");
    			add_location(input, file$c, 77, 6, 2027);
    			attr_dev(p, "class", "error svelte-1xb9kxf");
    			toggle_class(p, "show", /*error*/ ctx[2]);
    			add_location(p, file$c, 78, 6, 2127);
    			attr_dev(div0, "class", "input-col svelte-1xb9kxf");
    			add_location(div0, file$c, 76, 4, 1997);
    			attr_dev(form, "class", "svelte-1xb9kxf");
    			add_location(form, file$c, 74, 2, 1910);
    			attr_dev(div1, "class", "buttons svelte-1xb9kxf");
    			add_location(div1, file$c, 83, 2, 2206);
    			add_location(div2, file$c, 68, 0, 1815);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			if_block0.m(div2, null);
    			append_dev(div2, t0);
    			append_dev(div2, form);
    			append_dev(form, label);
    			append_dev(form, t2);
    			append_dev(form, div0);
    			append_dev(div0, input);
    			set_input_value(input, /*table*/ ctx[0].name);
    			append_dev(div0, t3);
    			append_dev(div0, p);
    			append_dev(p, t4);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			if_block1.m(div1, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[7]),
    					listen_dev(input, "input", /*input_handler*/ ctx[8], false, false, false),
    					listen_dev(form, "submit", prevent_default(/*submit*/ ctx[6]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div2, t0);
    				}
    			}

    			if (dirty & /*table*/ 1 && input.value !== /*table*/ ctx[0].name) {
    				set_input_value(input, /*table*/ ctx[0].name);
    			}

    			if (dirty & /*error*/ 4) set_data_dev(t4, /*error*/ ctx[2]);

    			if (dirty & /*error*/ 4) {
    				toggle_class(p, "show", /*error*/ ctx[2]);
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div1, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if_block0.d();
    			if_block1.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let { table } = $$props;
    	const dispatch = createEventDispatcher();
    	let sending = false;
    	let error = false;

    	function add() {
    		$$invalidate(1, sending = true);

    		post("/tables/", { name: table.name }).then(response => {
    			if (response.status === 200 || response.status === 400) return response.json();

    			if (response.status === 403) {
    				$$invalidate(2, error = "You are not allowed to add new tables");
    				$$invalidate(1, sending = false);
    			}
    		}).then(data => {
    			if (data.error) $$invalidate(2, error = data.error); else {
    				dispatch("update", data);
    				$$invalidate(0, table = data);
    			}

    			$$invalidate(1, sending = false);
    		});
    	}

    	function update() {
    		$$invalidate(1, sending = true);

    		patch("/tables/" + table.id + "/", { name: table.name }).then(response => {
    			if (response.status === 200 || response.status === 400) return response.json();
    			if (response.status === 403) $$invalidate(2, error = "You are not allowed to update tables.");
    			if (response.status === 404) $$invalidate(2, error = "Table not found.");
    			$$invalidate(1, sending = false);
    		}).then(data => {
    			if (data) {
    				if (data.error) $$invalidate(2, error = data.error); else {
    					dispatch("update", data);
    					$$invalidate(0, table = data);
    				}
    			}

    			$$invalidate(1, sending = false);
    		});
    	}

    	function delTable() {
    		$$invalidate(1, sending = true);

    		del("/tables/" + table.id + "/").then(response => {
    			if (response.status === 204) dispatch("delete", table.id);
    			if (response.status === 403) $$invalidate(2, error = "You are not allowed to delete tables.");
    			if (response.status === 404) $$invalidate(2, error = "Table not found.");
    			$$invalidate(1, sending = false);
    		});
    	}

    	function submit() {
    		if (!table.id) add(); else update();
    	}

    	const writable_props = ["table"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TableUpdate> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("TableUpdate", $$slots, []);

    	function input_input_handler() {
    		table.name = this.value;
    		$$invalidate(0, table);
    	}

    	const input_handler = () => $$invalidate(2, error = false);

    	$$self.$set = $$props => {
    		if ("table" in $$props) $$invalidate(0, table = $$props.table);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		post,
    		patch,
    		del,
    		toData,
    		table,
    		dispatch,
    		sending,
    		error,
    		add,
    		update,
    		delTable,
    		submit
    	});

    	$$self.$inject_state = $$props => {
    		if ("table" in $$props) $$invalidate(0, table = $$props.table);
    		if ("sending" in $$props) $$invalidate(1, sending = $$props.sending);
    		if ("error" in $$props) $$invalidate(2, error = $$props.error);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*table*/ 1) {
    			 {
    				if (!table.id && table.name === undefined) $$invalidate(0, table = { name: "" });
    			}
    		}
    	};

    	return [
    		table,
    		sending,
    		error,
    		add,
    		update,
    		delTable,
    		submit,
    		input_input_handler,
    		input_handler
    	];
    }

    class TableUpdate extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, { table: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TableUpdate",
    			options,
    			id: create_fragment$c.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*table*/ ctx[0] === undefined && !("table" in props)) {
    			console.warn("<TableUpdate> was created without expected prop 'table'");
    		}
    	}

    	get table() {
    		throw new Error("<TableUpdate>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set table(value) {
    		throw new Error("<TableUpdate>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/dashboard/TableList.svelte generated by Svelte v3.23.2 */
    const file$d = "src/dashboard/TableList.svelte";

    function get_each_context$6(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	return child_ctx;
    }

    // (1:0) <script>   import Review from '../Review.svelte';   import TableUpdate from './TableUpdate.svelte'   import { toData }
    function create_catch_block$2(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block$2.name,
    		type: "catch",
    		source: "(1:0) <script>   import Review from '../Review.svelte';   import TableUpdate from './TableUpdate.svelte'   import { toData }",
    		ctx
    	});

    	return block;
    }

    // (30:32)      {#each tables as table (table.id)}
    function create_then_block$2(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let each_value = /*tables*/ ctx[7];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*table*/ ctx[8].id;
    	validate_each_keys(ctx, each_value, get_each_context$6, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$6(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$6(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*review, allTables*/ 3) {
    				const each_value = /*tables*/ ctx[7];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$6, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, destroy_block, create_each_block$6, each_1_anchor, get_each_context$6);
    			}
    		},
    		d: function destroy(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block$2.name,
    		type: "then",
    		source: "(30:32)      {#each tables as table (table.id)}",
    		ctx
    	});

    	return block;
    }

    // (31:4) {#each tables as table (table.id)}
    function create_each_block$6(key_1, ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1_value = /*table*/ ctx[8].name + "";
    	let t1;
    	let t2;
    	let button;
    	let t4;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[4](/*table*/ ctx[8], ...args);
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text("Table ");
    			t1 = text(t1_value);
    			t2 = space();
    			button = element("button");
    			button.textContent = "View";
    			t4 = space();
    			add_location(div0, file$d, 32, 8, 834);
    			attr_dev(button, "class", "primary md");
    			add_location(button, file$d, 33, 8, 872);
    			attr_dev(div1, "class", "table striped svelte-37pbt4");
    			add_location(div1, file$d, 31, 6, 798);
    			this.first = div1;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			append_dev(div1, t2);
    			append_dev(div1, button);
    			append_dev(div1, t4);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*allTables*/ 1 && t1_value !== (t1_value = /*table*/ ctx[8].name + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$6.name,
    		type: "each",
    		source: "(31:4) {#each tables as table (table.id)}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import Review from '../Review.svelte';   import TableUpdate from './TableUpdate.svelte'   import { toData }
    function create_pending_block$2(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block$2.name,
    		type: "pending",
    		source: "(1:0) <script>   import Review from '../Review.svelte';   import TableUpdate from './TableUpdate.svelte'   import { toData }",
    		ctx
    	});

    	return block;
    }

    // (44:0) <Review bind:review={review}>
    function create_default_slot$2(ctx) {
    	let tableupdate;
    	let current;

    	tableupdate = new TableUpdate({
    			props: { table: /*review*/ ctx[1] },
    			$$inline: true
    		});

    	tableupdate.$on("delete", /*delTable*/ ctx[3]);
    	tableupdate.$on("update", /*update*/ ctx[2]);

    	const block = {
    		c: function create() {
    			create_component(tableupdate.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(tableupdate, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const tableupdate_changes = {};
    			if (dirty & /*review*/ 2) tableupdate_changes.table = /*review*/ ctx[1];
    			tableupdate.$set(tableupdate_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tableupdate.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tableupdate.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tableupdate, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(44:0) <Review bind:review={review}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
    	let h2;
    	let t1;
    	let div0;
    	let promise;
    	let t2;
    	let div1;
    	let button;
    	let t4;
    	let review_1;
    	let updating_review;
    	let current;
    	let mounted;
    	let dispose;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		pending: create_pending_block$2,
    		then: create_then_block$2,
    		catch: create_catch_block$2,
    		value: 7
    	};

    	handle_promise(promise = /*allTables*/ ctx[0], info);

    	function review_1_review_binding(value) {
    		/*review_1_review_binding*/ ctx[6].call(null, value);
    	}

    	let review_1_props = {
    		$$slots: { default: [create_default_slot$2] },
    		$$scope: { ctx }
    	};

    	if (/*review*/ ctx[1] !== void 0) {
    		review_1_props.review = /*review*/ ctx[1];
    	}

    	review_1 = new Review({ props: review_1_props, $$inline: true });
    	binding_callbacks.push(() => bind(review_1, "review", review_1_review_binding));

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Tables";
    			t1 = space();
    			div0 = element("div");
    			info.block.c();
    			t2 = space();
    			div1 = element("div");
    			button = element("button");
    			button.textContent = "Add New";
    			t4 = space();
    			create_component(review_1.$$.fragment);
    			add_location(h2, file$d, 27, 0, 682);
    			attr_dev(div0, "class", "section");
    			add_location(div0, file$d, 28, 0, 698);
    			attr_dev(button, "class", "primary md");
    			add_location(button, file$d, 40, 2, 1013);
    			attr_dev(div1, "class", "add-new svelte-37pbt4");
    			add_location(div1, file$d, 39, 0, 989);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div0, anchor);
    			info.block.m(div0, info.anchor = null);
    			info.mount = () => div0;
    			info.anchor = null;
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, button);
    			insert_dev(target, t4, anchor);
    			mount_component(review_1, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_1*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*allTables*/ 1 && promise !== (promise = /*allTables*/ ctx[0]) && handle_promise(promise, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[7] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}

    			const review_1_changes = {};

    			if (dirty & /*$$scope, review*/ 2050) {
    				review_1_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_review && dirty & /*review*/ 2) {
    				updating_review = true;
    				review_1_changes.review = /*review*/ ctx[1];
    				add_flush_callback(() => updating_review = false);
    			}

    			review_1.$set(review_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(review_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(review_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div0);
    			info.block.d();
    			info.token = null;
    			info = null;
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t4);
    			destroy_component(review_1, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props, $$invalidate) {
    	let allTables = fetch("/tables/").then(toData).then(data => data.tables);
    	let review = false;

    	function update(e) {
    		$$invalidate(0, allTables = allTables.then(tables => {
    			const index = tables.findIndex(table => table.id === e.detail.id);
    			if (index < 0) tables.push(e.detail); else tables[index] = e.detail;
    			return [...tables];
    		}));
    	}

    	function delTable(e) {
    		$$invalidate(0, allTables = allTables.then(tables => {
    			$$invalidate(1, review = false);
    			return [...tables.filter(table => table.id !== e.detail)];
    		}));
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TableList> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("TableList", $$slots, []);
    	const click_handler = table => $$invalidate(1, review = table);
    	const click_handler_1 = () => $$invalidate(1, review = {});

    	function review_1_review_binding(value) {
    		review = value;
    		$$invalidate(1, review);
    	}

    	$$self.$capture_state = () => ({
    		Review,
    		TableUpdate,
    		toData,
    		allTables,
    		review,
    		update,
    		delTable
    	});

    	$$self.$inject_state = $$props => {
    		if ("allTables" in $$props) $$invalidate(0, allTables = $$props.allTables);
    		if ("review" in $$props) $$invalidate(1, review = $$props.review);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		allTables,
    		review,
    		update,
    		delTable,
    		click_handler,
    		click_handler_1,
    		review_1_review_binding
    	];
    }

    class TableList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TableList",
    			options,
    			id: create_fragment$d.name
    		});
    	}
    }

    /* src/Switch.svelte generated by Svelte v3.23.2 */

    const file$e = "src/Switch.svelte";

    function create_fragment$e(ctx) {
    	let div1;
    	let div0;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "switch svelte-ielwjk");
    			add_location(div0, file$e, 5, 2, 110);
    			attr_dev(div1, "class", "container svelte-ielwjk");
    			toggle_class(div1, "set", /*set*/ ctx[0]);
    			add_location(div1, file$e, 4, 0, 46);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);

    			if (!mounted) {
    				dispose = listen_dev(div1, "click", /*click_handler*/ ctx[1], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*set*/ 1) {
    				toggle_class(div1, "set", /*set*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props, $$invalidate) {
    	let { set = false } = $$props;
    	const writable_props = ["set"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Switch> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Switch", $$slots, []);
    	const click_handler = () => $$invalidate(0, set = !set);

    	$$self.$set = $$props => {
    		if ("set" in $$props) $$invalidate(0, set = $$props.set);
    	};

    	$$self.$capture_state = () => ({ set });

    	$$self.$inject_state = $$props => {
    		if ("set" in $$props) $$invalidate(0, set = $$props.set);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [set, click_handler];
    }

    class Switch extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, { set: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Switch",
    			options,
    			id: create_fragment$e.name
    		});
    	}

    	get set() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set set(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/dashboard/MenuSectionUpdate.svelte generated by Svelte v3.23.2 */
    const file$f = "src/dashboard/MenuSectionUpdate.svelte";

    // (83:2) {:else}
    function create_else_block_1$1(ctx) {
    	let h3;
    	let t_value = /*section*/ ctx[0].name + "";
    	let t;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			t = text(t_value);
    			attr_dev(h3, "class", "svelte-r4hfmv");
    			add_location(h3, file$f, 83, 2, 2313);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*section*/ 1 && t_value !== (t_value = /*section*/ ctx[0].name + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$1.name,
    		type: "else",
    		source: "(83:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (81:2) {#if !section.id}
    function create_if_block_1$3(ctx) {
    	let h3;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "New Section";
    			attr_dev(h3, "class", "svelte-r4hfmv");
    			add_location(h3, file$f, 81, 2, 2280);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(81:2) {#if !section.id}",
    		ctx
    	});

    	return block;
    }

    // (104:4) {:else}
    function create_else_block$2(ctx) {
    	let button0;
    	let t0;
    	let t1;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			t0 = text("Update Section");
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Delete Section";
    			attr_dev(button0, "class", "primary md");
    			button0.disabled = /*sending*/ ctx[6];
    			add_location(button0, file$f, 104, 4, 3096);
    			attr_dev(button1, "class", "secondary md");
    			add_location(button1, file$f, 105, 4, 3188);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);
    			append_dev(button0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button1, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*update*/ ctx[8], false, false, false),
    					listen_dev(button1, "click", /*delSection*/ ctx[9], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sending*/ 64) {
    				prop_dev(button0, "disabled", /*sending*/ ctx[6]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(104:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (102:4) {#if !section.id}
    function create_if_block$7(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Add Section");
    			attr_dev(button, "class", "primary md");
    			button.disabled = /*sending*/ ctx[6];
    			add_location(button, file$f, 102, 4, 2998);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*add*/ ctx[7], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sending*/ 64) {
    				prop_dev(button, "disabled", /*sending*/ ctx[6]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$7.name,
    		type: "if",
    		source: "(102:4) {#if !section.id}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$f(ctx) {
    	let div4;
    	let t0;
    	let p0;
    	let t1;
    	let t2;
    	let form;
    	let div0;
    	let label0;
    	let t4;
    	let input;
    	let t5;
    	let p1;
    	let t6_value = /*errors*/ ctx[5].name + "";
    	let t6;
    	let t7;
    	let div1;
    	let label1;
    	let t9;
    	let textarea;
    	let t10;
    	let div2;
    	let t11;
    	let switch_1;
    	let updating_set;
    	let t12;
    	let div3;
    	let current;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (!/*section*/ ctx[0].id) return create_if_block_1$3;
    		return create_else_block_1$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function switch_1_set_binding(value) {
    		/*switch_1_set_binding*/ ctx[13].call(null, value);
    	}

    	let switch_1_props = {};

    	if (/*visible*/ ctx[3] !== void 0) {
    		switch_1_props.set = /*visible*/ ctx[3];
    	}

    	switch_1 = new Switch({ props: switch_1_props, $$inline: true });
    	binding_callbacks.push(() => bind(switch_1, "set", switch_1_set_binding));

    	function select_block_type_1(ctx, dirty) {
    		if (!/*section*/ ctx[0].id) return create_if_block$7;
    		return create_else_block$2;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			if_block0.c();
    			t0 = space();
    			p0 = element("p");
    			t1 = text(/*error*/ ctx[4]);
    			t2 = space();
    			form = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Item name:";
    			t4 = space();
    			input = element("input");
    			t5 = space();
    			p1 = element("p");
    			t6 = text(t6_value);
    			t7 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Description:";
    			t9 = space();
    			textarea = element("textarea");
    			t10 = space();
    			div2 = element("div");
    			t11 = text("Visible: ");
    			create_component(switch_1.$$.fragment);
    			t12 = space();
    			div3 = element("div");
    			if_block1.c();
    			attr_dev(p0, "class", "error svelte-r4hfmv");
    			toggle_class(p0, "show", /*error*/ ctx[4]);
    			add_location(p0, file$f, 85, 2, 2347);
    			attr_dev(label0, "for", "name");
    			attr_dev(label0, "class", "svelte-r4hfmv");
    			add_location(label0, file$f, 88, 6, 2471);
    			attr_dev(input, "id", "name");
    			attr_dev(input, "type", "text");
    			input.required = true;
    			attr_dev(input, "class", "svelte-r4hfmv");
    			toggle_class(input, "invalid", /*errors*/ ctx[5].name);
    			add_location(input, file$f, 89, 6, 2514);
    			attr_dev(div0, "class", "name svelte-r4hfmv");
    			add_location(div0, file$f, 87, 4, 2446);
    			attr_dev(p1, "class", "error svelte-r4hfmv");
    			toggle_class(p1, "show", /*error*/ ctx[4]);
    			add_location(p1, file$f, 91, 4, 2645);
    			attr_dev(label1, "for", "description");
    			add_location(label1, file$f, 93, 6, 2735);
    			attr_dev(textarea, "id", "description");
    			attr_dev(textarea, "class", "svelte-r4hfmv");
    			add_location(textarea, file$f, 94, 6, 2787);
    			attr_dev(div1, "class", "description svelte-r4hfmv");
    			add_location(div1, file$f, 92, 4, 2703);
    			add_location(form, file$f, 86, 2, 2397);
    			attr_dev(div2, "class", "visible svelte-r4hfmv");
    			add_location(div2, file$f, 97, 2, 2874);
    			attr_dev(div3, "class", "buttons svelte-r4hfmv");
    			add_location(div3, file$f, 100, 2, 2950);
    			add_location(div4, file$f, 79, 0, 2252);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			if_block0.m(div4, null);
    			append_dev(div4, t0);
    			append_dev(div4, p0);
    			append_dev(p0, t1);
    			append_dev(div4, t2);
    			append_dev(div4, form);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t4);
    			append_dev(div0, input);
    			set_input_value(input, /*name*/ ctx[1]);
    			append_dev(form, t5);
    			append_dev(form, p1);
    			append_dev(p1, t6);
    			append_dev(form, t7);
    			append_dev(form, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t9);
    			append_dev(div1, textarea);
    			set_input_value(textarea, /*description*/ ctx[2]);
    			append_dev(div4, t10);
    			append_dev(div4, div2);
    			append_dev(div2, t11);
    			mount_component(switch_1, div2, null);
    			append_dev(div4, t12);
    			append_dev(div4, div3);
    			if_block1.m(div3, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[10]),
    					listen_dev(input, "input", /*input_handler*/ ctx[11], false, false, false),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[12]),
    					listen_dev(form, "submit", prevent_default(submit_handler), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div4, t0);
    				}
    			}

    			if (!current || dirty & /*error*/ 16) set_data_dev(t1, /*error*/ ctx[4]);

    			if (dirty & /*error*/ 16) {
    				toggle_class(p0, "show", /*error*/ ctx[4]);
    			}

    			if (dirty & /*name*/ 2 && input.value !== /*name*/ ctx[1]) {
    				set_input_value(input, /*name*/ ctx[1]);
    			}

    			if (dirty & /*errors*/ 32) {
    				toggle_class(input, "invalid", /*errors*/ ctx[5].name);
    			}

    			if ((!current || dirty & /*errors*/ 32) && t6_value !== (t6_value = /*errors*/ ctx[5].name + "")) set_data_dev(t6, t6_value);

    			if (dirty & /*error*/ 16) {
    				toggle_class(p1, "show", /*error*/ ctx[4]);
    			}

    			if (dirty & /*description*/ 4) {
    				set_input_value(textarea, /*description*/ ctx[2]);
    			}

    			const switch_1_changes = {};

    			if (!updating_set && dirty & /*visible*/ 8) {
    				updating_set = true;
    				switch_1_changes.set = /*visible*/ ctx[3];
    				add_flush_callback(() => updating_set = false);
    			}

    			switch_1.$set(switch_1_changes);

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div3, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(switch_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(switch_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			if_block0.d();
    			destroy_component(switch_1);
    			if_block1.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$f.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const submit_handler = () => {
    	
    };

    function instance$f($$self, $$props, $$invalidate) {
    	let { section = {} } = $$props;
    	const dispatch = createEventDispatcher();
    	let name, description, visible;
    	let error = false;
    	let errors = {};
    	let sending = false;

    	onMount(() => {
    		if (!section.id) {
    			$$invalidate(1, name = "");
    			$$invalidate(2, description = "");
    			$$invalidate(3, visible = true);
    		} else {
    			$$invalidate(1, { name, description, visible } = section, name, $$invalidate(2, description), $$invalidate(3, visible));
    		}
    	});

    	function add() {
    		$$invalidate(6, sending = true);

    		post("/menu/sections/", { name, description, visible }).then(response => {
    			if (response.status === 200 || response.status === 400) return response.json();

    			if (response.status === 403) {
    				$$invalidate(4, error = "You are not allowed to add new sections");
    				$$invalidate(6, sending = false);
    			}
    		}).then(data => {
    			if (data.error) {
    				$$invalidate(4, error = data.error);
    				$$invalidate(5, errors = data.errors);
    			} else {
    				dispatch("update", { "section": data });
    				$$invalidate(0, section = data);
    				$$invalidate(1, { name, description, visible } = data, name, $$invalidate(2, description), $$invalidate(3, visible));
    			}

    			$$invalidate(6, sending = false);
    		});
    	}

    	function update() {
    		$$invalidate(6, sending = true);

    		patch("/menu/sections/" + section.id + "/", { name, description, visible }).then(response => {
    			if (response.status === 200 || response.status === 400) return response.json();
    			if (response.status === 403) $$invalidate(4, error = "You are not allowed to update sections.");
    			if (response.status === 404) $$invalidate(4, error = "Section not found.");
    			$$invalidate(6, sending = false);
    		}).then(data => {
    			if (data) {
    				if (data.error) {
    					$$invalidate(4, error = data.error);
    					$$invalidate(5, errors = data.errors);
    				} else {
    					dispatch("update", { "section": data });
    					$$invalidate(0, section = data);
    					$$invalidate(1, { name, description, visible } = data, name, $$invalidate(2, description), $$invalidate(3, visible));
    				}
    			}

    			$$invalidate(6, sending = false);
    		});
    	}

    	function delSection() {
    		$$invalidate(6, sending = true);

    		del("/menu/sections/" + section.id + "/").then(response => {
    			if (response.status === 204) dispatch("delete", { section: { id: section.id } });
    			if (response.status === 403) $$invalidate(4, error = "You are not allowed to delete sections.");
    			if (response.status === 404) $$invalidate(4, error = "Section not found.");
    			$$invalidate(6, sending = false);
    		});
    	}

    	const writable_props = ["section"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MenuSectionUpdate> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("MenuSectionUpdate", $$slots, []);

    	function input_input_handler() {
    		name = this.value;
    		$$invalidate(1, name);
    	}

    	const input_handler = () => $$invalidate(4, error = false);

    	function textarea_input_handler() {
    		description = this.value;
    		$$invalidate(2, description);
    	}

    	function switch_1_set_binding(value) {
    		visible = value;
    		$$invalidate(3, visible);
    	}

    	$$self.$set = $$props => {
    		if ("section" in $$props) $$invalidate(0, section = $$props.section);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		onMount,
    		post,
    		patch,
    		del,
    		toData,
    		Switch,
    		section,
    		dispatch,
    		name,
    		description,
    		visible,
    		error,
    		errors,
    		sending,
    		add,
    		update,
    		delSection
    	});

    	$$self.$inject_state = $$props => {
    		if ("section" in $$props) $$invalidate(0, section = $$props.section);
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("description" in $$props) $$invalidate(2, description = $$props.description);
    		if ("visible" in $$props) $$invalidate(3, visible = $$props.visible);
    		if ("error" in $$props) $$invalidate(4, error = $$props.error);
    		if ("errors" in $$props) $$invalidate(5, errors = $$props.errors);
    		if ("sending" in $$props) $$invalidate(6, sending = $$props.sending);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		section,
    		name,
    		description,
    		visible,
    		error,
    		errors,
    		sending,
    		add,
    		update,
    		delSection,
    		input_input_handler,
    		input_handler,
    		textarea_input_handler,
    		switch_1_set_binding
    	];
    }

    class MenuSectionUpdate extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$f, create_fragment$f, safe_not_equal, { section: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MenuSectionUpdate",
    			options,
    			id: create_fragment$f.name
    		});
    	}

    	get section() {
    		throw new Error("<MenuSectionUpdate>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set section(value) {
    		throw new Error("<MenuSectionUpdate>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/dashboard/MenuItemUpdate.svelte generated by Svelte v3.23.2 */
    const file$g = "src/dashboard/MenuItemUpdate.svelte";

    // (86:2) {:else}
    function create_else_block_1$2(ctx) {
    	let h3;
    	let t_value = /*item*/ ctx[0].name + "";
    	let t;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			t = text(t_value);
    			attr_dev(h3, "class", "svelte-1a4j597");
    			add_location(h3, file$g, 86, 2, 2491);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*item*/ 1 && t_value !== (t_value = /*item*/ ctx[0].name + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$2.name,
    		type: "else",
    		source: "(86:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (84:2) {#if !item.id}
    function create_if_block_1$4(ctx) {
    	let h3;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "New Item";
    			attr_dev(h3, "class", "svelte-1a4j597");
    			add_location(h3, file$g, 84, 2, 2461);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(84:2) {#if !item.id}",
    		ctx
    	});

    	return block;
    }

    // (113:4) {:else}
    function create_else_block$3(ctx) {
    	let button0;
    	let t0;
    	let t1;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			t0 = text("Update Item");
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Delete Item";
    			attr_dev(button0, "class", "primary md");
    			button0.disabled = /*sending*/ ctx[8];
    			add_location(button0, file$g, 113, 4, 3525);
    			attr_dev(button1, "class", "secondary md");
    			add_location(button1, file$g, 114, 4, 3614);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);
    			append_dev(button0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button1, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*update*/ ctx[10], false, false, false),
    					listen_dev(button1, "click", /*delSection*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sending*/ 256) {
    				prop_dev(button0, "disabled", /*sending*/ ctx[8]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(113:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (111:4) {#if !item.id}
    function create_if_block$8(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Add Item");
    			attr_dev(button, "class", "primary md");
    			button.disabled = /*sending*/ ctx[8];
    			add_location(button, file$g, 111, 4, 3430);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*add*/ ctx[9], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sending*/ 256) {
    				prop_dev(button, "disabled", /*sending*/ ctx[8]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$8.name,
    		type: "if",
    		source: "(111:4) {#if !item.id}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$g(ctx) {
    	let div5;
    	let t0;
    	let p0;
    	let t1;
    	let t2;
    	let form;
    	let div0;
    	let label0;
    	let t4;
    	let input0;
    	let t5;
    	let p1;
    	let t6_value = /*errors*/ ctx[7].name + "";
    	let t6;
    	let t7;
    	let div1;
    	let label1;
    	let t9;
    	let textarea;
    	let t10;
    	let div2;
    	let label2;
    	let t12;
    	let input1;
    	let t13;
    	let switch0;
    	let updating_set;
    	let t14;
    	let p2;
    	let t15_value = /*errors*/ ctx[7].price + "";
    	let t15;
    	let t16;
    	let div3;
    	let t17;
    	let switch1;
    	let updating_set_1;
    	let t18;
    	let div4;
    	let current;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (!/*item*/ ctx[0].id) return create_if_block_1$4;
    		return create_else_block_1$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function switch0_set_binding(value) {
    		/*switch0_set_binding*/ ctx[17].call(null, value);
    	}

    	let switch0_props = {};

    	if (/*vat*/ ctx[4] !== void 0) {
    		switch0_props.set = /*vat*/ ctx[4];
    	}

    	switch0 = new Switch({ props: switch0_props, $$inline: true });
    	binding_callbacks.push(() => bind(switch0, "set", switch0_set_binding));

    	function switch1_set_binding(value) {
    		/*switch1_set_binding*/ ctx[18].call(null, value);
    	}

    	let switch1_props = {};

    	if (/*visible*/ ctx[5] !== void 0) {
    		switch1_props.set = /*visible*/ ctx[5];
    	}

    	switch1 = new Switch({ props: switch1_props, $$inline: true });
    	binding_callbacks.push(() => bind(switch1, "set", switch1_set_binding));

    	function select_block_type_1(ctx, dirty) {
    		if (!/*item*/ ctx[0].id) return create_if_block$8;
    		return create_else_block$3;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			if_block0.c();
    			t0 = space();
    			p0 = element("p");
    			t1 = text(/*error*/ ctx[6]);
    			t2 = space();
    			form = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Item name:";
    			t4 = space();
    			input0 = element("input");
    			t5 = space();
    			p1 = element("p");
    			t6 = text(t6_value);
    			t7 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Description:";
    			t9 = space();
    			textarea = element("textarea");
    			t10 = space();
    			div2 = element("div");
    			label2 = element("label");
    			label2.textContent = "Price:";
    			t12 = text("\n    £");
    			input1 = element("input");
    			t13 = text("\n    Vat: ");
    			create_component(switch0.$$.fragment);
    			t14 = space();
    			p2 = element("p");
    			t15 = text(t15_value);
    			t16 = space();
    			div3 = element("div");
    			t17 = text("Visible: ");
    			create_component(switch1.$$.fragment);
    			t18 = space();
    			div4 = element("div");
    			if_block1.c();
    			attr_dev(p0, "class", "error svelte-1a4j597");
    			toggle_class(p0, "show", /*error*/ ctx[6]);
    			add_location(p0, file$g, 88, 2, 2522);
    			attr_dev(label0, "for", "name");
    			attr_dev(label0, "class", "svelte-1a4j597");
    			add_location(label0, file$g, 91, 6, 2646);
    			attr_dev(input0, "id", "name");
    			attr_dev(input0, "type", "text");
    			input0.required = true;
    			attr_dev(input0, "class", "svelte-1a4j597");
    			toggle_class(input0, "invalid", /*errors*/ ctx[7].name);
    			add_location(input0, file$g, 92, 6, 2689);
    			attr_dev(div0, "class", "name svelte-1a4j597");
    			add_location(div0, file$g, 90, 4, 2621);
    			attr_dev(p1, "class", "error svelte-1a4j597");
    			toggle_class(p1, "show", /*errors*/ ctx[7].name);
    			add_location(p1, file$g, 94, 4, 2826);
    			attr_dev(label1, "for", "description");
    			attr_dev(label1, "class", "svelte-1a4j597");
    			add_location(label1, file$g, 96, 4, 2918);
    			attr_dev(textarea, "id", "description");
    			attr_dev(textarea, "class", "svelte-1a4j597");
    			add_location(textarea, file$g, 97, 4, 2968);
    			attr_dev(div1, "class", "description svelte-1a4j597");
    			add_location(div1, file$g, 95, 2, 2888);
    			attr_dev(label2, "for", "price");
    			attr_dev(label2, "class", "svelte-1a4j597");
    			add_location(label2, file$g, 100, 4, 3067);
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "id", "price");
    			attr_dev(input1, "class", "svelte-1a4j597");
    			toggle_class(input1, "invalid", /*errors*/ ctx[7].price);
    			add_location(input1, file$g, 101, 5, 3106);
    			attr_dev(p2, "class", "error svelte-1a4j597");
    			toggle_class(p2, "show", /*errors*/ ctx[7].price);
    			add_location(p2, file$g, 103, 4, 3226);
    			attr_dev(div2, "class", "price svelte-1a4j597");
    			add_location(div2, file$g, 99, 2, 3043);
    			add_location(form, file$g, 89, 2, 2572);
    			attr_dev(div3, "class", "visible svelte-1a4j597");
    			add_location(div3, file$g, 106, 2, 3309);
    			attr_dev(div4, "class", "buttons svelte-1a4j597");
    			add_location(div4, file$g, 109, 2, 3385);
    			add_location(div5, file$g, 82, 0, 2436);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			if_block0.m(div5, null);
    			append_dev(div5, t0);
    			append_dev(div5, p0);
    			append_dev(p0, t1);
    			append_dev(div5, t2);
    			append_dev(div5, form);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t4);
    			append_dev(div0, input0);
    			set_input_value(input0, /*name*/ ctx[1]);
    			append_dev(form, t5);
    			append_dev(form, p1);
    			append_dev(p1, t6);
    			append_dev(form, t7);
    			append_dev(form, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t9);
    			append_dev(div1, textarea);
    			set_input_value(textarea, /*description*/ ctx[2]);
    			append_dev(form, t10);
    			append_dev(form, div2);
    			append_dev(div2, label2);
    			append_dev(div2, t12);
    			append_dev(div2, input1);
    			set_input_value(input1, /*price*/ ctx[3]);
    			append_dev(div2, t13);
    			mount_component(switch0, div2, null);
    			append_dev(div2, t14);
    			append_dev(div2, p2);
    			append_dev(p2, t15);
    			append_dev(div5, t16);
    			append_dev(div5, div3);
    			append_dev(div3, t17);
    			mount_component(switch1, div3, null);
    			append_dev(div5, t18);
    			append_dev(div5, div4);
    			if_block1.m(div4, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[13]),
    					listen_dev(input0, "input", /*input_handler*/ ctx[14], false, false, false),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[15]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[16]),
    					listen_dev(form, "submit", prevent_default(submit_handler$1), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div5, t0);
    				}
    			}

    			if (!current || dirty & /*error*/ 64) set_data_dev(t1, /*error*/ ctx[6]);

    			if (dirty & /*error*/ 64) {
    				toggle_class(p0, "show", /*error*/ ctx[6]);
    			}

    			if (dirty & /*name*/ 2 && input0.value !== /*name*/ ctx[1]) {
    				set_input_value(input0, /*name*/ ctx[1]);
    			}

    			if (dirty & /*errors*/ 128) {
    				toggle_class(input0, "invalid", /*errors*/ ctx[7].name);
    			}

    			if ((!current || dirty & /*errors*/ 128) && t6_value !== (t6_value = /*errors*/ ctx[7].name + "")) set_data_dev(t6, t6_value);

    			if (dirty & /*errors*/ 128) {
    				toggle_class(p1, "show", /*errors*/ ctx[7].name);
    			}

    			if (dirty & /*description*/ 4) {
    				set_input_value(textarea, /*description*/ ctx[2]);
    			}

    			if (dirty & /*price*/ 8 && to_number(input1.value) !== /*price*/ ctx[3]) {
    				set_input_value(input1, /*price*/ ctx[3]);
    			}

    			if (dirty & /*errors*/ 128) {
    				toggle_class(input1, "invalid", /*errors*/ ctx[7].price);
    			}

    			const switch0_changes = {};

    			if (!updating_set && dirty & /*vat*/ 16) {
    				updating_set = true;
    				switch0_changes.set = /*vat*/ ctx[4];
    				add_flush_callback(() => updating_set = false);
    			}

    			switch0.$set(switch0_changes);
    			if ((!current || dirty & /*errors*/ 128) && t15_value !== (t15_value = /*errors*/ ctx[7].price + "")) set_data_dev(t15, t15_value);

    			if (dirty & /*errors*/ 128) {
    				toggle_class(p2, "show", /*errors*/ ctx[7].price);
    			}

    			const switch1_changes = {};

    			if (!updating_set_1 && dirty & /*visible*/ 32) {
    				updating_set_1 = true;
    				switch1_changes.set = /*visible*/ ctx[5];
    				add_flush_callback(() => updating_set_1 = false);
    			}

    			switch1.$set(switch1_changes);

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div4, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(switch0.$$.fragment, local);
    			transition_in(switch1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(switch0.$$.fragment, local);
    			transition_out(switch1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			if_block0.d();
    			destroy_component(switch0);
    			destroy_component(switch1);
    			if_block1.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const submit_handler$1 = () => {
    	
    };

    function instance$g($$self, $$props, $$invalidate) {
    	let { item = {} } = $$props;
    	let { section = false } = $$props;
    	const dispatch = createEventDispatcher();
    	let name, description, price, vat, visible;
    	let error = false;
    	let errors = {};
    	let sending = false;

    	onMount(() => {
    		if (!item.id) {
    			$$invalidate(1, name = "");
    			$$invalidate(2, description = "");
    			$$invalidate(3, price = "0.00");
    			$$invalidate(4, vat = true);
    			$$invalidate(5, visible = true);
    		} else {
    			$$invalidate(1, { name, description, price, vat, visible } = item, name, $$invalidate(2, description), $$invalidate(3, price), $$invalidate(4, vat), $$invalidate(5, visible));
    		}
    	});

    	function add() {
    		$$invalidate(8, sending = true);

    		post("/menu/items/", {
    			name,
    			description,
    			price,
    			vat,
    			visible,
    			section: section.id
    		}).then(response => {
    			if (response.status === 200 || response.status === 400) return response.json();

    			if (response.status === 403) {
    				$$invalidate(6, error = "You are not allowed to add new items");
    				$$invalidate(8, sending = false);
    			}
    		}).then(data => {
    			if (data.error) {
    				$$invalidate(6, error = data.error);
    				$$invalidate(7, errors = data.errors);
    			} else {
    				data.sectionId = section.id;
    				dispatch("update", { "item": data });
    				$$invalidate(0, item = data);
    				$$invalidate(1, { name, description, price, vat, visible } = data, name, $$invalidate(2, description), $$invalidate(3, price), $$invalidate(4, vat), $$invalidate(5, visible));
    			}

    			$$invalidate(8, sending = false);
    		});
    	}

    	function update() {
    		patch("/menu/items/" + item.id + "/", { name, description, price, vat, visible }).then(response => {
    			if (response.status === 200 || response.status === 400) return response.json();
    			if (response.status === 403) $$invalidate(6, error = "You are not allowed to update items.");
    			if (response.status === 404) $$invalidate(6, error = "Item not found.");
    			$$invalidate(8, sending = false);
    		}).then(data => {
    			if (data) {
    				if (data.error) {
    					$$invalidate(6, error = data.error);
    					$$invalidate(7, errors = data.errors);
    				} else {
    					data.sectionId = section.id;
    					dispatch("update", { "item": data });
    					$$invalidate(0, item = data);
    					$$invalidate(1, { name, description, price, vat, visible } = data, name, $$invalidate(2, description), $$invalidate(3, price), $$invalidate(4, vat), $$invalidate(5, visible));
    				}
    			}

    			$$invalidate(8, sending = false);
    		});
    	}

    	function delSection() {
    		$$invalidate(8, sending = true);

    		del("/menu/items/" + item.id + "/").then(response => {
    			if (response.status === 204) dispatch("delete", {
    				item: { id: item.id, sectionId: section.id }
    			});

    			if (response.status === 403) $$invalidate(6, error = "You are not allowed to delete items.");
    			if (response.status === 404) $$invalidate(6, error = "Item not found.");
    			$$invalidate(8, sending = false);
    		});
    	}

    	const writable_props = ["item", "section"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MenuItemUpdate> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("MenuItemUpdate", $$slots, []);

    	function input0_input_handler() {
    		name = this.value;
    		$$invalidate(1, name);
    	}

    	const input_handler = () => $$invalidate(7, errors.name = false, errors);

    	function textarea_input_handler() {
    		description = this.value;
    		$$invalidate(2, description);
    	}

    	function input1_input_handler() {
    		price = to_number(this.value);
    		$$invalidate(3, price);
    	}

    	function switch0_set_binding(value) {
    		vat = value;
    		$$invalidate(4, vat);
    	}

    	function switch1_set_binding(value) {
    		visible = value;
    		$$invalidate(5, visible);
    	}

    	$$self.$set = $$props => {
    		if ("item" in $$props) $$invalidate(0, item = $$props.item);
    		if ("section" in $$props) $$invalidate(12, section = $$props.section);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		onMount,
    		Switch,
    		post,
    		patch,
    		del,
    		toData,
    		item,
    		section,
    		dispatch,
    		name,
    		description,
    		price,
    		vat,
    		visible,
    		error,
    		errors,
    		sending,
    		add,
    		update,
    		delSection
    	});

    	$$self.$inject_state = $$props => {
    		if ("item" in $$props) $$invalidate(0, item = $$props.item);
    		if ("section" in $$props) $$invalidate(12, section = $$props.section);
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("description" in $$props) $$invalidate(2, description = $$props.description);
    		if ("price" in $$props) $$invalidate(3, price = $$props.price);
    		if ("vat" in $$props) $$invalidate(4, vat = $$props.vat);
    		if ("visible" in $$props) $$invalidate(5, visible = $$props.visible);
    		if ("error" in $$props) $$invalidate(6, error = $$props.error);
    		if ("errors" in $$props) $$invalidate(7, errors = $$props.errors);
    		if ("sending" in $$props) $$invalidate(8, sending = $$props.sending);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		item,
    		name,
    		description,
    		price,
    		vat,
    		visible,
    		error,
    		errors,
    		sending,
    		add,
    		update,
    		delSection,
    		section,
    		input0_input_handler,
    		input_handler,
    		textarea_input_handler,
    		input1_input_handler,
    		switch0_set_binding,
    		switch1_set_binding
    	];
    }

    class MenuItemUpdate extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$g, create_fragment$g, safe_not_equal, { item: 0, section: 12 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MenuItemUpdate",
    			options,
    			id: create_fragment$g.name
    		});
    	}

    	get item() {
    		throw new Error("<MenuItemUpdate>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set item(value) {
    		throw new Error("<MenuItemUpdate>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get section() {
    		throw new Error("<MenuItemUpdate>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set section(value) {
    		throw new Error("<MenuItemUpdate>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/dashboard/DashboardMenuItem.svelte generated by Svelte v3.23.2 */
    const file$h = "src/dashboard/DashboardMenuItem.svelte";

    // (13:4) {#if item.description}
    function create_if_block$9(ctx) {
    	let p;
    	let t_value = /*item*/ ctx[0].description + "";
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(t_value);
    			attr_dev(p, "class", "description");
    			add_location(p, file$h, 13, 4, 350);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*item*/ 1 && t_value !== (t_value = /*item*/ ctx[0].description + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$9.name,
    		type: "if",
    		source: "(13:4) {#if item.description}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$h(ctx) {
    	let div4;
    	let div0;
    	let h4;
    	let t0_value = /*item*/ ctx[0].name + "";
    	let t0;
    	let t1;
    	let t2_value = /*item*/ ctx[0].id + "";
    	let t2;
    	let t3;
    	let t4;
    	let div1;
    	let t5;
    	let t6_value = Number.parseFloat(/*item*/ ctx[0].price).toFixed(2) + "";
    	let t6;
    	let t7;
    	let div2;
    	let button0;
    	let t9;
    	let div3;
    	let button1;
    	let t10;
    	let t11;
    	let button2;
    	let t12;
    	let mounted;
    	let dispose;
    	let if_block = /*item*/ ctx[0].description && create_if_block$9(ctx);

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div0 = element("div");
    			h4 = element("h4");
    			t0 = text(t0_value);
    			t1 = text(" - ");
    			t2 = text(t2_value);
    			t3 = space();
    			if (if_block) if_block.c();
    			t4 = space();
    			div1 = element("div");
    			t5 = text("£");
    			t6 = text(t6_value);
    			t7 = space();
    			div2 = element("div");
    			button0 = element("button");
    			button0.textContent = "Edit";
    			t9 = space();
    			div3 = element("div");
    			button1 = element("button");
    			t10 = text("+");
    			t11 = space();
    			button2 = element("button");
    			t12 = text("-");
    			attr_dev(h4, "class", "name svelte-lun6nw");
    			add_location(h4, file$h, 11, 4, 273);
    			attr_dev(div0, "class", "details svelte-lun6nw");
    			add_location(div0, file$h, 10, 2, 247);
    			attr_dev(div1, "class", "price svelte-lun6nw");
    			add_location(div1, file$h, 16, 2, 417);
    			attr_dev(button0, "class", "primary md");
    			add_location(button0, file$h, 20, 4, 506);
    			add_location(div2, file$h, 19, 2, 496);
    			attr_dev(button1, "class", "primary svelte-lun6nw");
    			button1.disabled = /*first*/ ctx[1];
    			add_location(button1, file$h, 23, 4, 630);
    			attr_dev(button2, "class", "primary svelte-lun6nw");
    			button2.disabled = /*last*/ ctx[2];
    			add_location(button2, file$h, 24, 4, 724);
    			attr_dev(div3, "class", "up-down svelte-lun6nw");
    			add_location(div3, file$h, 22, 2, 604);
    			attr_dev(div4, "class", "striped svelte-lun6nw");
    			toggle_class(div4, "hidden", !/*item*/ ctx[0].visible);
    			add_location(div4, file$h, 9, 0, 194);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div0);
    			append_dev(div0, h4);
    			append_dev(h4, t0);
    			append_dev(h4, t1);
    			append_dev(h4, t2);
    			append_dev(div0, t3);
    			if (if_block) if_block.m(div0, null);
    			append_dev(div4, t4);
    			append_dev(div4, div1);
    			append_dev(div1, t5);
    			append_dev(div1, t6);
    			append_dev(div4, t7);
    			append_dev(div4, div2);
    			append_dev(div2, button0);
    			append_dev(div4, t9);
    			append_dev(div4, div3);
    			append_dev(div3, button1);
    			append_dev(button1, t10);
    			append_dev(div3, t11);
    			append_dev(div3, button2);
    			append_dev(button2, t12);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[5], false, false, false),
    					listen_dev(button2, "click", /*click_handler_2*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*item*/ 1 && t0_value !== (t0_value = /*item*/ ctx[0].name + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*item*/ 1 && t2_value !== (t2_value = /*item*/ ctx[0].id + "")) set_data_dev(t2, t2_value);

    			if (/*item*/ ctx[0].description) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$9(ctx);
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*item*/ 1 && t6_value !== (t6_value = Number.parseFloat(/*item*/ ctx[0].price).toFixed(2) + "")) set_data_dev(t6, t6_value);

    			if (dirty & /*first*/ 2) {
    				prop_dev(button1, "disabled", /*first*/ ctx[1]);
    			}

    			if (dirty & /*last*/ 4) {
    				prop_dev(button2, "disabled", /*last*/ ctx[2]);
    			}

    			if (dirty & /*item*/ 1) {
    				toggle_class(div4, "hidden", !/*item*/ ctx[0].visible);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$h.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$h($$self, $$props, $$invalidate) {
    	let { item = {} } = $$props;
    	let { first = false } = $$props;
    	let { last = false } = $$props;
    	const dispatch = createEventDispatcher();
    	const writable_props = ["item", "first", "last"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<DashboardMenuItem> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("DashboardMenuItem", $$slots, []);
    	const click_handler = () => dispatch("edititem", item);
    	const click_handler_1 = () => dispatch("moveup");
    	const click_handler_2 = () => dispatch("movedown");

    	$$self.$set = $$props => {
    		if ("item" in $$props) $$invalidate(0, item = $$props.item);
    		if ("first" in $$props) $$invalidate(1, first = $$props.first);
    		if ("last" in $$props) $$invalidate(2, last = $$props.last);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		item,
    		first,
    		last,
    		dispatch
    	});

    	$$self.$inject_state = $$props => {
    		if ("item" in $$props) $$invalidate(0, item = $$props.item);
    		if ("first" in $$props) $$invalidate(1, first = $$props.first);
    		if ("last" in $$props) $$invalidate(2, last = $$props.last);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [item, first, last, dispatch, click_handler, click_handler_1, click_handler_2];
    }

    class DashboardMenuItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$h, create_fragment$h, safe_not_equal, { item: 0, first: 1, last: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DashboardMenuItem",
    			options,
    			id: create_fragment$h.name
    		});
    	}

    	get item() {
    		throw new Error("<DashboardMenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set item(value) {
    		throw new Error("<DashboardMenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get first() {
    		throw new Error("<DashboardMenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set first(value) {
    		throw new Error("<DashboardMenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get last() {
    		throw new Error("<DashboardMenuItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set last(value) {
    		throw new Error("<DashboardMenuItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/dashboard/MenuEdit.svelte generated by Svelte v3.23.2 */

    const { console: console_1$2 } = globals;
    const file$i = "src/dashboard/MenuEdit.svelte";

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i];
    	child_ctx[27] = i;
    	return child_ctx;
    }

    function get_each_context$7(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[22] = list[i];
    	child_ctx[24] = i;
    	return child_ctx;
    }

    // (1:0) <script>   import Review from '../Review.svelte';   import MenuSectionUpdate from './MenuSectionUpdate.svelte';   import MenuItemUpdate from './MenuItemUpdate.svelte';   import DashboardMenuItem from './DashboardMenuItem.svelte';   import { post }
    function create_catch_block$3(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block$3.name,
    		type: "catch",
    		source: "(1:0) <script>   import Review from '../Review.svelte';   import MenuSectionUpdate from './MenuSectionUpdate.svelte';   import MenuItemUpdate from './MenuItemUpdate.svelte';   import DashboardMenuItem from './DashboardMenuItem.svelte';   import { post }",
    		ctx
    	});

    	return block;
    }

    // (129:34)      {#each sections as section, i (section.id)}
    function create_then_block$3(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let current;
    	let each_value = /*sections*/ ctx[21];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*section*/ ctx[22].id;
    	validate_each_keys(ctx, each_value, get_each_context$7, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$7(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$7(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*menuItems, openItemUpdate, moveItemUp, moveItemDown, moveDown, moveUp, openSectionUpdate*/ 1948) {
    				const each_value = /*sections*/ ctx[21];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$7, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block$7, each_1_anchor, get_each_context$7);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block$3.name,
    		type: "then",
    		source: "(129:34)      {#each sections as section, i (section.id)}",
    		ctx
    	});

    	return block;
    }

    // (146:10) {#each section.items as item, j (item.id)}
    function create_each_block_1(key_1, ctx) {
    	let first;
    	let dashboardmenuitem;
    	let current;

    	function edititem_handler(...args) {
    		return /*edititem_handler*/ ctx[14](/*section*/ ctx[22], ...args);
    	}

    	function moveup_handler(...args) {
    		return /*moveup_handler*/ ctx[15](/*section*/ ctx[22], /*item*/ ctx[25], ...args);
    	}

    	function movedown_handler(...args) {
    		return /*movedown_handler*/ ctx[16](/*section*/ ctx[22], /*item*/ ctx[25], ...args);
    	}

    	dashboardmenuitem = new DashboardMenuItem({
    			props: {
    				item: /*item*/ ctx[25],
    				last: /*j*/ ctx[27] === /*section*/ ctx[22].items.length - 1,
    				first: /*j*/ ctx[27] === 0
    			},
    			$$inline: true
    		});

    	dashboardmenuitem.$on("edititem", edititem_handler);
    	dashboardmenuitem.$on("moveup", moveup_handler);
    	dashboardmenuitem.$on("movedown", movedown_handler);

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(dashboardmenuitem.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(dashboardmenuitem, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const dashboardmenuitem_changes = {};
    			if (dirty & /*menuItems*/ 4) dashboardmenuitem_changes.item = /*item*/ ctx[25];
    			if (dirty & /*menuItems*/ 4) dashboardmenuitem_changes.last = /*j*/ ctx[27] === /*section*/ ctx[22].items.length - 1;
    			if (dirty & /*menuItems*/ 4) dashboardmenuitem_changes.first = /*j*/ ctx[27] === 0;
    			dashboardmenuitem.$set(dashboardmenuitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dashboardmenuitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dashboardmenuitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(dashboardmenuitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(146:10) {#each section.items as item, j (item.id)}",
    		ctx
    	});

    	return block;
    }

    // (130:4) {#each sections as section, i (section.id)}
    function create_each_block$7(key_1, ctx) {
    	let div6;
    	let div3;
    	let div0;
    	let h3;
    	let t0_value = /*section*/ ctx[22].name + "";
    	let t0;
    	let t1;
    	let p;
    	let t2_value = /*section*/ ctx[22].description + "";
    	let t2;
    	let t3;
    	let div1;
    	let button0;
    	let t5;
    	let div2;
    	let button1;
    	let t6;
    	let button1_disabled_value;
    	let t7;
    	let button2;
    	let t8;
    	let button2_disabled_value;
    	let t9;
    	let div4;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t10;
    	let div5;
    	let button3;
    	let t12;
    	let current;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[11](/*section*/ ctx[22], ...args);
    	}

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[12](/*section*/ ctx[22], ...args);
    	}

    	function click_handler_2(...args) {
    		return /*click_handler_2*/ ctx[13](/*section*/ ctx[22], ...args);
    	}

    	let each_value_1 = /*section*/ ctx[22].items;
    	validate_each_argument(each_value_1);
    	const get_key = ctx => /*item*/ ctx[25].id;
    	validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		let child_ctx = get_each_context_1(ctx, each_value_1, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
    	}

    	function click_handler_3(...args) {
    		return /*click_handler_3*/ ctx[17](/*section*/ ctx[22], ...args);
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			div6 = element("div");
    			div3 = element("div");
    			div0 = element("div");
    			h3 = element("h3");
    			t0 = text(t0_value);
    			t1 = space();
    			p = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			div1 = element("div");
    			button0 = element("button");
    			button0.textContent = "Edit";
    			t5 = space();
    			div2 = element("div");
    			button1 = element("button");
    			t6 = text("+");
    			t7 = space();
    			button2 = element("button");
    			t8 = text("-");
    			t9 = space();
    			div4 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t10 = space();
    			div5 = element("div");
    			button3 = element("button");
    			button3.textContent = "Add New Item";
    			t12 = space();
    			add_location(h3, file$i, 133, 12, 5146);
    			attr_dev(p, "class", "description");
    			add_location(p, file$i, 134, 12, 5182);
    			attr_dev(div0, "class", "details svelte-hjs7g4");
    			add_location(div0, file$i, 132, 10, 5112);
    			attr_dev(button0, "class", "primary md");
    			add_location(button0, file$i, 137, 12, 5276);
    			add_location(div1, file$i, 136, 10, 5258);
    			attr_dev(button1, "class", "primary svelte-hjs7g4");
    			button1.disabled = button1_disabled_value = /*i*/ ctx[24] === 0;
    			add_location(button1, file$i, 140, 12, 5424);
    			attr_dev(button2, "class", "primary svelte-hjs7g4");
    			button2.disabled = button2_disabled_value = /*i*/ ctx[24] === /*sections*/ ctx[21].length - 1;
    			add_location(button2, file$i, 141, 12, 5528);
    			attr_dev(div2, "class", "up-down svelte-hjs7g4");
    			add_location(div2, file$i, 139, 10, 5390);
    			attr_dev(div3, "class", "section-inner svelte-hjs7g4");
    			add_location(div3, file$i, 131, 8, 5074);
    			add_location(div4, file$i, 144, 8, 5679);
    			attr_dev(button3, "class", "primary md");
    			add_location(button3, file$i, 153, 10, 6096);
    			attr_dev(div5, "class", "add-new svelte-hjs7g4");
    			add_location(div5, file$i, 152, 8, 6064);
    			attr_dev(div6, "class", "section");
    			toggle_class(div6, "hidden", !/*section*/ ctx[22].visible);
    			add_location(div6, file$i, 130, 6, 5012);
    			this.first = div6;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div3);
    			append_dev(div3, div0);
    			append_dev(div0, h3);
    			append_dev(h3, t0);
    			append_dev(div0, t1);
    			append_dev(div0, p);
    			append_dev(p, t2);
    			append_dev(div3, t3);
    			append_dev(div3, div1);
    			append_dev(div1, button0);
    			append_dev(div3, t5);
    			append_dev(div3, div2);
    			append_dev(div2, button1);
    			append_dev(button1, t6);
    			append_dev(div2, t7);
    			append_dev(div2, button2);
    			append_dev(button2, t8);
    			append_dev(div6, t9);
    			append_dev(div6, div4);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div4, null);
    			}

    			append_dev(div6, t10);
    			append_dev(div6, div5);
    			append_dev(div5, button3);
    			append_dev(div6, t12);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", click_handler, false, false, false),
    					listen_dev(button1, "click", click_handler_1, false, false, false),
    					listen_dev(button2, "click", click_handler_2, false, false, false),
    					listen_dev(button3, "click", click_handler_3, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*menuItems*/ 4) && t0_value !== (t0_value = /*section*/ ctx[22].name + "")) set_data_dev(t0, t0_value);
    			if ((!current || dirty & /*menuItems*/ 4) && t2_value !== (t2_value = /*section*/ ctx[22].description + "")) set_data_dev(t2, t2_value);

    			if (!current || dirty & /*menuItems*/ 4 && button1_disabled_value !== (button1_disabled_value = /*i*/ ctx[24] === 0)) {
    				prop_dev(button1, "disabled", button1_disabled_value);
    			}

    			if (!current || dirty & /*menuItems*/ 4 && button2_disabled_value !== (button2_disabled_value = /*i*/ ctx[24] === /*sections*/ ctx[21].length - 1)) {
    				prop_dev(button2, "disabled", button2_disabled_value);
    			}

    			if (dirty & /*menuItems, openItemUpdate, moveItemUp, moveItemDown*/ 1556) {
    				const each_value_1 = /*section*/ ctx[22].items;
    				validate_each_argument(each_value_1);
    				group_outros();
    				validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, div4, outro_and_destroy_block, create_each_block_1, null, get_each_context_1);
    				check_outros();
    			}

    			if (dirty & /*menuItems*/ 4) {
    				toggle_class(div6, "hidden", !/*section*/ ctx[22].visible);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$7.name,
    		type: "each",
    		source: "(130:4) {#each sections as section, i (section.id)}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import Review from '../Review.svelte';   import MenuSectionUpdate from './MenuSectionUpdate.svelte';   import MenuItemUpdate from './MenuItemUpdate.svelte';   import DashboardMenuItem from './DashboardMenuItem.svelte';   import { post }
    function create_pending_block$3(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block$3.name,
    		type: "pending",
    		source: "(1:0) <script>   import Review from '../Review.svelte';   import MenuSectionUpdate from './MenuSectionUpdate.svelte';   import MenuItemUpdate from './MenuItemUpdate.svelte';   import DashboardMenuItem from './DashboardMenuItem.svelte';   import { post }",
    		ctx
    	});

    	return block;
    }

    // (165:0) <Review bind:review={review}>
    function create_default_slot$3(ctx) {
    	let switch_instance;
    	let t0;
    	let div;
    	let button;
    	let current;
    	let mounted;
    	let dispose;
    	const switch_instance_spread_levels = [/*reviewData*/ ctx[1]];
    	var switch_value = /*review*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("delete", /*delItemOrSection*/ ctx[5]);
    		switch_instance.$on("update", /*updateItemOrSection*/ ctx[6]);
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			t0 = space();
    			div = element("div");
    			button = element("button");
    			button.textContent = "Back to menu";
    			attr_dev(button, "class", "primary md");
    			add_location(button, file$i, 167, 4, 6548);
    			attr_dev(div, "class", "back svelte-hjs7g4");
    			add_location(div, file$i, 166, 2, 6525);
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, button);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_5*/ ctx[19], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*reviewData*/ 2)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*reviewData*/ ctx[1])])
    			: {};

    			if (switch_value !== (switch_value = /*review*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("delete", /*delItemOrSection*/ ctx[5]);
    					switch_instance.$on("update", /*updateItemOrSection*/ ctx[6]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, t0.parentNode, t0);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (switch_instance) destroy_component(switch_instance, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$3.name,
    		type: "slot",
    		source: "(165:0) <Review bind:review={review}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$i(ctx) {
    	let h2;
    	let t1;
    	let div0;
    	let promise;
    	let t2;
    	let div1;
    	let button;
    	let t4;
    	let review_1;
    	let updating_review;
    	let current;
    	let mounted;
    	let dispose;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		pending: create_pending_block$3,
    		then: create_then_block$3,
    		catch: create_catch_block$3,
    		value: 21,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*menuItems*/ ctx[2], info);

    	function review_1_review_binding(value) {
    		/*review_1_review_binding*/ ctx[20].call(null, value);
    	}

    	let review_1_props = {
    		$$slots: { default: [create_default_slot$3] },
    		$$scope: { ctx }
    	};

    	if (/*review*/ ctx[0] !== void 0) {
    		review_1_props.review = /*review*/ ctx[0];
    	}

    	review_1 = new Review({ props: review_1_props, $$inline: true });
    	binding_callbacks.push(() => bind(review_1, "review", review_1_review_binding));

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Menu";
    			t1 = space();
    			div0 = element("div");
    			info.block.c();
    			t2 = space();
    			div1 = element("div");
    			button = element("button");
    			button.textContent = "Add New Menu Section";
    			t4 = space();
    			create_component(review_1.$$.fragment);
    			add_location(h2, file$i, 126, 0, 4903);
    			add_location(div0, file$i, 127, 0, 4917);
    			attr_dev(button, "class", "primary md");
    			add_location(button, file$i, 161, 2, 6276);
    			attr_dev(div1, "class", "add-new svelte-hjs7g4");
    			add_location(div1, file$i, 160, 0, 6252);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div0, anchor);
    			info.block.m(div0, info.anchor = null);
    			info.mount = () => div0;
    			info.anchor = null;
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, button);
    			insert_dev(target, t4, anchor);
    			mount_component(review_1, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_4*/ ctx[18], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*menuItems*/ 4 && promise !== (promise = /*menuItems*/ ctx[2]) && handle_promise(promise, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[21] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}

    			const review_1_changes = {};

    			if (dirty & /*$$scope, review, reviewData*/ 268435459) {
    				review_1_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_review && dirty & /*review*/ 1) {
    				updating_review = true;
    				review_1_changes.review = /*review*/ ctx[0];
    				add_flush_callback(() => updating_review = false);
    			}

    			review_1.$set(review_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(info.block);
    			transition_in(review_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			transition_out(review_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div0);
    			info.block.d();
    			info.token = null;
    			info = null;
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t4);
    			destroy_component(review_1, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$i.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$i($$self, $$props, $$invalidate) {
    	let review = false;
    	let reviewData = {};

    	let menuItems = fetch("/menu/").then(response => response.json()).then(data => {
    		console.log(data.sections);
    		return data.sections;
    	});

    	function openSectionUpdate(section = {}) {
    		$$invalidate(0, review = MenuSectionUpdate);
    		$$invalidate(1, reviewData = { section });
    	}

    	function openItemUpdate(item, section) {
    		$$invalidate(0, review = MenuItemUpdate);
    		$$invalidate(1, reviewData = { item, section });
    	}

    	function delItemOrSection(e) {
    		if (e.detail.section) $$invalidate(2, menuItems = menuItems.then(sections => {
    			$$invalidate(0, review = false);
    			return [...sections.filter(section => section.id !== e.detail.section.id)];
    		})); else if (e.detail.item) $$invalidate(2, menuItems = menuItems.then(sections => {
    			$$invalidate(0, review = false);
    			const parentSection = sections.find(section => section.id === e.detail.item.sectionId);
    			parentSection.items = [...parentSection.items.filter(item => item.id !== e.detail.item.id)];
    			return [...sections];
    		}));
    	}

    	function updateItemOrSection(e) {
    		console.log(e.detail);

    		if (e.detail.section) $$invalidate(2, menuItems = menuItems.then(sections => {
    			$$invalidate(0, review = false);
    			const index = sections.findIndex(section => section.id === e.detail.section.id);
    			if (index < 0) return [...sections, e.detail.section]; else sections[index] = e.detail.section;
    			return [...sections];
    		})); else if (e.detail.item) $$invalidate(2, menuItems = menuItems.then(sections => {
    			$$invalidate(0, review = false);
    			const parentSection = sections.find(section => section.id === e.detail.item.sectionId);
    			const index = parentSection.items.findIndex(item => item.id === e.detail.item.id);
    			if (index < 0) parentSection.items = [...parentSection.items, e.detail.item]; else parentSection.items[index] = e.detail.item;
    			return [...sections];
    		}));
    	}

    	function moveUp(curSection) {
    		post("/menu/sections/" + curSection.id + "/", { "up": true }).then(response => {
    			if (response.status === 204) $$invalidate(2, menuItems = menuItems.then(sections => {
    				const index = sections.findIndex(section => section.id === curSection.id);

    				if (index > 0) {
    					const oldOrder = curSection.order;
    					curSection.order = sections[index - 1].order;
    					sections[index - 1].order = oldOrder;
    					sections[index] = sections[index - 1];
    					sections[index - 1] = curSection;
    				}

    				return [...sections];
    			}));
    		});
    	}

    	function moveDown(curSection) {
    		post("/menu/sections/" + curSection.id + "/", { "down": true }).then(response => {
    			if (response.status === 204) $$invalidate(2, menuItems = menuItems.then(sections => {
    				const index = sections.findIndex(section => section.id === curSection.id);

    				if (index < sections.length - 1) {
    					const oldOrder = curSection.order;
    					curSection.order = sections[index + 1].order;
    					sections[index + 1].order = oldOrder;
    					sections[index] = sections[index + 1];
    					sections[index + 1] = curSection;
    				}

    				return [...sections];
    			}));
    		});
    	}

    	function moveItemUp(curSection, curItem) {
    		post("/menu/items/" + curItem.id + "/", { "up": true }).then(response => {
    			if (response.status === 204) $$invalidate(2, menuItems = menuItems.then(sections => {
    				const parentSection = sections.find(section => section.id === curSection.id);
    				const index = parentSection.items.findIndex(item => item.id === curItem.id);

    				if (index > 0) {
    					const oldOrder = curItem.order;
    					curItem.order = parentSection.items[index - 1].order;
    					parentSection.items[index - 1].order = oldOrder;
    					parentSection.items[index] = parentSection.items[index - 1];
    					parentSection.items[index - 1] = curItem;
    				}

    				return [...sections];
    			}));
    		});
    	}

    	function moveItemDown(curSection, curItem) {
    		post("/menu/items/" + curItem.id + "/", { "down": true }).then(response => {
    			if (response.status === 204) $$invalidate(2, menuItems = menuItems.then(sections => {
    				const parentSection = sections.find(section => section.id === curSection.id);
    				const index = parentSection.items.findIndex(item => item.id === curItem.id);

    				if (index < parentSection.items.length - 1) {
    					const oldOrder = curItem.order;
    					curItem.order = parentSection.items[index + 1].order;
    					parentSection.items[index + 1].order = oldOrder;
    					parentSection.items[index] = parentSection.items[index + 1];
    					parentSection.items[index + 1] = curItem;
    				}

    				return [...sections];
    			}));
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$2.warn(`<MenuEdit> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("MenuEdit", $$slots, []);
    	const click_handler = section => openSectionUpdate(section);
    	const click_handler_1 = section => moveUp(section);
    	const click_handler_2 = section => moveDown(section);
    	const edititem_handler = (section, e) => openItemUpdate(e.detail, section);
    	const moveup_handler = (section, item) => moveItemUp(section, item);
    	const movedown_handler = (section, item) => moveItemDown(section, item);
    	const click_handler_3 = section => openItemUpdate({}, section);
    	const click_handler_4 = () => openSectionUpdate();
    	const click_handler_5 = () => $$invalidate(0, review = false);

    	function review_1_review_binding(value) {
    		review = value;
    		$$invalidate(0, review);
    	}

    	$$self.$capture_state = () => ({
    		Review,
    		MenuSectionUpdate,
    		MenuItemUpdate,
    		DashboardMenuItem,
    		post,
    		review,
    		reviewData,
    		menuItems,
    		openSectionUpdate,
    		openItemUpdate,
    		delItemOrSection,
    		updateItemOrSection,
    		moveUp,
    		moveDown,
    		moveItemUp,
    		moveItemDown
    	});

    	$$self.$inject_state = $$props => {
    		if ("review" in $$props) $$invalidate(0, review = $$props.review);
    		if ("reviewData" in $$props) $$invalidate(1, reviewData = $$props.reviewData);
    		if ("menuItems" in $$props) $$invalidate(2, menuItems = $$props.menuItems);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		review,
    		reviewData,
    		menuItems,
    		openSectionUpdate,
    		openItemUpdate,
    		delItemOrSection,
    		updateItemOrSection,
    		moveUp,
    		moveDown,
    		moveItemUp,
    		moveItemDown,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		edititem_handler,
    		moveup_handler,
    		movedown_handler,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		review_1_review_binding
    	];
    }

    class MenuEdit extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$i, create_fragment$i, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MenuEdit",
    			options,
    			id: create_fragment$i.name
    		});
    	}
    }

    /* src/dashboard/Dashboard.svelte generated by Svelte v3.23.2 */
    const file$j = "src/dashboard/Dashboard.svelte";

    function create_fragment$j(ctx) {
    	let h1;
    	let t1;
    	let div;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let button2;
    	let t7;
    	let button3;
    	let t9;
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	var switch_value = /*current*/ ctx[0];

    	function switch_props(ctx) {
    		return { $$inline: true };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Dashboard";
    			t1 = space();
    			div = element("div");
    			button0 = element("button");
    			button0.textContent = "Orders";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Tables";
    			t5 = space();
    			button2 = element("button");
    			button2.textContent = "Menu";
    			t7 = space();
    			button3 = element("button");
    			button3.textContent = "Log Out";
    			t9 = space();
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    			attr_dev(h1, "class", "center");
    			add_location(h1, file$j, 7, 0, 189);
    			attr_dev(button0, "class", "primary md");
    			add_location(button0, file$j, 9, 2, 246);
    			attr_dev(button1, "class", "primary md");
    			add_location(button1, file$j, 10, 2, 332);
    			attr_dev(button2, "class", "primary md");
    			add_location(button2, file$j, 11, 2, 416);
    			attr_dev(button3, "class", "secondary md");
    			add_location(button3, file$j, 12, 2, 497);
    			attr_dev(div, "class", "center");
    			add_location(div, file$j, 8, 0, 223);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(div, t3);
    			append_dev(div, button1);
    			append_dev(div, t5);
    			append_dev(div, button2);
    			append_dev(div, t7);
    			append_dev(div, button3);
    			insert_dev(target, t9, anchor);

    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[1], false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[2], false, false, false),
    					listen_dev(button2, "click", /*click_handler_2*/ ctx[3], false, false, false),
    					listen_dev(button3, "click", /*click_handler_3*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (switch_value !== (switch_value = /*current*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$j.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$j($$self, $$props, $$invalidate) {
    	let current = DailyOrders;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Dashboard> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Dashboard", $$slots, []);
    	const click_handler = () => $$invalidate(0, current = DailyOrders);
    	const click_handler_1 = () => $$invalidate(0, current = TableList);
    	const click_handler_2 = () => $$invalidate(0, current = MenuEdit);
    	const click_handler_3 = () => window.location = "/admin/logout/";

    	$$self.$capture_state = () => ({
    		DailyOrders,
    		TableList,
    		MenuEdit,
    		current
    	});

    	$$self.$inject_state = $$props => {
    		if ("current" in $$props) $$invalidate(0, current = $$props.current);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [current, click_handler, click_handler_1, click_handler_2, click_handler_3];
    }

    class Dashboard extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$j, create_fragment$j, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Dashboard",
    			options,
    			id: create_fragment$j.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.23.2 */
    const file$k = "src/App.svelte";

    // (12:0) {:else}
    function create_else_block$4(ctx) {
    	let signin;
    	let current;
    	signin = new CheckIn({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(signin.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(signin, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(signin.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(signin.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(signin, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$4.name,
    		type: "else",
    		source: "(12:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (10:17) 
    function create_if_block_1$5(ctx) {
    	let menu;
    	let current;
    	menu = new Menu({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(menu.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(menu, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menu.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menu.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(menu, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$5.name,
    		type: "if",
    		source: "(10:17) ",
    		ctx
    	});

    	return block;
    }

    // (8:0) {#if $user}
    function create_if_block$a(ctx) {
    	let dashboard;
    	let current;
    	dashboard = new Dashboard({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(dashboard.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(dashboard, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dashboard.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dashboard.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(dashboard, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$a.name,
    		type: "if",
    		source: "(8:0) {#if $user}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$k(ctx) {
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block$a, create_if_block_1$5, create_else_block$4];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$user*/ ctx[0]) return 0;
    		if (/*$group*/ ctx[1]) return 1;
    		return 2;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			add_location(main, file$k, 6, 0, 209);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_blocks[current_block_type_index].m(main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index !== previous_block_index) {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(main, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$k.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$k($$self, $$props, $$invalidate) {
    	let $user;
    	let $group;
    	validate_store(user, "user");
    	component_subscribe($$self, user, $$value => $$invalidate(0, $user = $$value));
    	validate_store(group, "group");
    	component_subscribe($$self, group, $$value => $$invalidate(1, $group = $$value));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	$$self.$capture_state = () => ({
    		SignIn: CheckIn,
    		Menu,
    		Dashboard,
    		group,
    		user,
    		$user,
    		$group
    	});

    	return [$user, $group];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$k, create_fragment$k, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$k.name
    		});
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
