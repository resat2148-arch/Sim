# core/montecarlo  (Faz 1 · adım 3)

Senaryoyu N kez (varsayılan 10.000) sabit seed ile koşturur. Her deneme
`core/random` içinden `rng.fork("trial:i")` ile kendi akışını alır; böylece
tüm hareket stratejileri aynı rastgele koşullarla karşılaştırılır.
Zaman bütçesi kaçış modeli de burada: fark etme mesafesi / hız − tepki süresi.
