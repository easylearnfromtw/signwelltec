/* SIGNWELL below-fold module loader */
(function(){
  'use strict';

  const page = document.body && document.body.dataset.page || '';
  const jobs = {
    home: [
      { selector:'#audience', src:'assets/js/people-guide.js?v=20261007-lazy' },
      { selector:'#identity', src:'assets/js/donations.js?v=20261007-home-identity-capital5' }
    ],
    'social-responsibility': [
      { selector:'#giving', src:'assets/js/donations.js?v=20261007-totalfix1' }
    ]
  }[page] || [];

  if(!jobs.length) return;

  function load(job){
    if(job.loaded) return;
    job.loaded = true;
    const script = document.createElement('script');
    script.src = job.src;
    script.async = true;
    document.head.appendChild(script);
  }

  jobs.forEach(job => {
    if(job.early){
      const start = () => load(job);
      if('requestIdleCallback' in window) requestIdleCallback(start,{timeout:320});
      else setTimeout(start,160);
      return;
    }

    const target = document.querySelector(job.selector);
    if(!target){ load(job); return; }

    if(!('IntersectionObserver' in window)){ load(job); return; }

    const observer = new IntersectionObserver(entries => {
      if(entries.some(entry => entry.isIntersecting)){
        observer.disconnect();
        load(job);
      }
    }, { rootMargin:'700px 0px', threshold:0 });

    observer.observe(target);
  });
})();