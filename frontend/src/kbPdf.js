import { jsPDF } from 'jspdf';

const LOGO_B64 = '/9j/4AAQSkZJRgABAQEA3ADcAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAB2AXgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKK5T43fHP4O/s2fDDVvjT8fPiXo3hHwpocIl1TXtevkt7eAFgqLuY/M7uyoiLl3dlRQzMAfxo/be/4PT/gL4C1PUvBP7BH7OOoeP5oobiG08ceNrt9K0z7QCBFPFYqhuruBhklZXspBjGBnIAP3Cor+Vj4m/wDB4p/wV68e6cll4VtvhT4JkVwzXnhnwXNNI44+UjUbq6TH0UHnr0x0/wAMf+D0P/gp34VudLtfiP8ABz4P+KtPt7mI6tIdB1Cxv72AMDIqSxXphhkZcgP9ndVOCY2wQQD+oCivyt/4J8/8HbP/AATv/a71az+H/wC0VY3nwH8VXbMI28WapHdeH5W3nYi6qqRCJtg3M11DbxKflEjnGf1RR1dQ6HKnkEd6AForxn/goJ+2z8O/+CdP7Ini79sj4seF9a1rw/4P+wf2hpvh2OFryb7Xf29inliaSNDiS5Rjlx8qtjJwD+aH/EbF/wAE7f8Ao2D40/8AgBpH/wAn0AfsrRX41f8AEbF/wTt/6Nf+NP8A4AaR/wDJ9fqj+yX+058MP2zv2avBP7U3wa1L7R4b8ceH7fVNPVriGSW0Z1xLaTmF3RbiCUSQTIrNslhkQnKmgD0SiiigAor4b/4Kwf8ABfX9kH/gkT8RPCfwm+N3g/xd4o8ReKtFm1caX4OtrV5NOslm8mKac3M8I2zSJcKmwsc2sm4L8u75O/4jYv8Agnb/ANGwfGn/AMANI/8Ak+gD9laK/KP9mT/g7p/YT/am/aL8C/s1eCv2dvi1Yax4+8Waf4f0u+1Sy0tba3uLu4SBJJTHeswQM4J2qxwDgHpX6uUAFFfmz/wUS/4Odv2OP+CbX7WPiH9kH4u/Av4ma3r3hy2sZ7vUvDdpp7Wci3VpFcoEM13G+Qkqg5Ucg4yOa8Vs/wDg9g/4JwSXKpqH7M/xuihP+skh0rR5GH0U6ioP5igD9kKK+L/+Cb//AAXy/wCCcf8AwU+15Ph38DPiTqHh3x1MZmtfh74+sY9P1a8jiRpGkt/Lllt7r92kkhSGaSRI42d0RRmuo/4Kuf8ABWj4G/8ABIv4S+GfjB8dvh74s8RWHijxEdHs7bwlDbPNFMIJJ97i4miXZtjI4JOSOO9AH1RRXjP/AAT7/bZ+Hf8AwUW/ZE8I/tkfCfwvrWi+H/GH2/8As/TfEUcK3kP2S/uLF/MEMkicyWzsMOflZc4OQPZqACiivjX/AIK3/wDBbH9nb/gjv/wr/wD4X58L/GniT/hYv9rf2T/wh9vaSfZ/sH2PzfO+0XEWN322Pbt3fdbOOMgH2VRXlvgv9r74ReJf2J9J/b48RXN74d8Bah8Lbfx/fTalZtNcaZpD6auou0sVt5rPJHASWSLzCSpCbuM8D+xD/wAFcf8Agnr/AMFHPFeueCP2Mv2gv+Ey1Tw3p8d9rVr/AMInq2nfZ7d38tX3X1rCr5bjCkkdxigD6QooooAKKK/On/gmn/wcp/sh/wDBUH9p+1/ZV+DPwR+JGg63d6LealHqHie109LUR26hnUmC7kfcQePlx6kUAfotRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFeQ/t0fty/s7f8E6/2btc/ai/ab8XHTPD+jqIrWztVWS+1m+cMYdPsoSy+dcylTtUlURVeSR44o5JE9er+VX/g69/4KZ61+2B+3xffsn+AvFEzfDn4I3UmkfY4ZmEGoeJBldRu3Qxo2+B82KhjIq/ZppImC3LggHyb/wAFVP8AgrF+01/wVl/aCm+L3xv1ZtN8O6a8kPgX4fafeM+neHLNm+6uQvn3LgKZrplDysqgCOKOGGL5for9cf8AgiJ/wa5/Eb/goJ4K0j9q39sbxZq3gD4TasjzeHdH0dI117xNBsZY7mNpkeOytTJtZZJI5HnRG2RoksVwQD8jqK/tQ+DP/BDX/gkH8CPB58EeCv8Agnb8LL+za6e5a48Z+F4vEV5vYKCPtWq/aJwnyjEYcIpLEKCxz57+2F/wba/8Ihv2wdEkhuf2WtL+GutixitbHxJ8IY49AltESfzS32SFDYTO+WjaSe2kk8tsKylY2QA/jxr9VP8Ag3y/4OJfHP8AwTk8X6f+y3+1p4i1LxB8BNYvFjt7qTzLq88BTu3N1aqMvLYMTmezUErzPbr5nmw3fzj/AMFf/wDgix+0r/wSA+KGm6F8TdVs/FfgjxM8w8HfEDSLVoYb4xEb7e4gZma0uVVkcxFnRlbMckmyTZ8c0Af15f8ABzhruieKf+CBnxm8TeGdZtdR03UbXwrdafqFjcLNBdQSeJdIdJY3QlXRlIZWBIIIIJBr+Q2v1f8A2fv+Cl3iP9oX/g2a/aY/YD+MPi9tQ8QfCWHwlfeBZtQ1HzLq58NTeKdKjNqqld5isZ/LQOXIWO+toVVEhUH8oKACv6N/+DLj9vWTx58DvHv/AATv8ca95moeA7r/AISjwLBPcszto93KEvoI0CbY4re9aOYkuWd9WbCgITX85FfTn/BHb9urUP8AgnR/wUW+Gv7TE+vSWXhu11tNM8fLi4eObQLsiC9LwwMGuDFG32mOMhh59tA21ioFAH9sFFIrK6h0bKnkEd6/Pz/g5q/bmH7E3/BKPxraaDMP+En+K3/FB+Hl8sOIkvoZft07DzEdAljHdKkibtlxJb5UqTQB/NL/AMFkP27Lj/goz/wUZ+JX7TVhq1xceGrvWP7L8CRSyT7IdDsx9ntGSKYlrfzlQ3UkQCgTXUxwCxr5hoooA+j/APgjz/yle/Zt/wCy4eGP/Tpb1/bbX8SX/BHn/lK9+zb/ANlw8Mf+nS3r+22gD+Rn/g6y/wCU33xT/wCwR4c/9MllX9Hvjb/gh5/wSG8f+F7zwhrv/BOr4U29rfQmKabRfCkOm3SqR1jubMRTQt/tRurDsa/nC/4Osv8AlN98U/8AsEeHP/TJZV/XNQB/Il/wXq/4Jy2v/BFf/gpD4f1T9knxJ4i0nwvrNpa+NPhrqUzu03h2+hvHD2MN2xJuGtZoYpkdv3iRXFushkcGaT9h/wDgrV/wVb+F/wANf+CUf7NP7aP7Qv7Afwt+Nz/Fix0fUZ/CXjS0gudO0S+u9E+2TSW32m3ucMjF4RkBgpILHkH89v8Ag8u/bO+Hnx3/AG1/AX7L3w51fTtVHwf8OXp8SajY3DO1vrGpTRGbT3+UJuhgs7RyUZsNcvG214mUen/8HEXwy8RfBn/g3z/Yk+F3jHw7qGj61otroFvrmkatbtFdWN9/wjbG4t5UYBkdJS6FSMqVweQaAP1C/wCCbn/BQ79mc/8ABFbw3/wUN8VfCDwb8B/hvp+k69qF54P8KRQw6ZpEdtrV9amO1jiihV5rmaPcsSRh5bi6CKGdxu/M/Vf+Dsf/AIKq/tV/GXxBpX/BMD/gmlp/irwpo6hk0+68E654n1mOAyOsd1d/2Tcwx2wlAX91scIwZRNLgNXE/G2f4qQ/8GTnwfj+HovP7Il+I10vjr7LHlP7K/4SrWzH5xx8sf8AaA0/B4+fyx3wfsv/AIMvIvAQ/wCCXfjCbw3ERrTfGbUV8RvMse8uNO03yApHzeSIiNu7/loZsd6APAvi7/weqfEb4ea1Z+Cm/wCCbE2j+JtLtZrPx94d8WeLprSfR9ahvLiKW1RTaCQqIkt2bzY4pI5ZJoijCJZZPqb/AIOYv+CifwH/AGBf+FKf8Lt/4Jx/C39oH/hLP+Ek/sz/AIWVp1rcf2D9l/svzPs3n2lxt8/7RHv27M/Z487sDb+Vf/B4xH8JI/8Agrvbn4b/ANjf2w3wn0U+Pv7LZDP/AGv596I/te3kT/2cNNxu+byPI/hK19Tf8Hzn/Nrv/c7f+4CgD6N/4Kxf8FE/2gvAv/BF/wCGX/DL3/BOS+17wT8fP2X9T/4TD/hCdOu20r4U6VceHbLy8/ZLRoYraGG+n2eZ5CBLBsYUNs/Hr/g3z/bw/a6/YP8AjL8QvF37I37A/ij4+alr3hm2s9X0fwvY388mlwJcb1ncWVrcMFZvlG4KM9yeK/ff/nVl/wC7AP8A3SK/L7/gyH/5Or+N/wD2T3T/AP0uoA/VD/gtB/wXh+Bn/BH3wZ4f0jWvAVx45+Jni6ya78P+BbPV47Nbe1SVEe7vpiskltCSZViIhczSQSINoSSSP89tS/4OCP8Ag5Vsv2dl/bLP/BK/wHF8K7i0OpweIpPAOuvs0vyzML11GrCQWvk/vPthiWAphw20ivc/+Djv/gqt+wD+xJ8Z9D+FvxE/4Jp/C74+fGS+8Fx3UOtfEbwzpt1beH9Mae6FrFJLNbzXE375Z5PsitCoWXzPMBkGfJ/2p/jR/wAHTf7Sv/BO/wCI8Pxg/ZV+CvwG+Fkfwi1bWPFF9bW4h1S78Ox6RPJc6StnNfahJaTS2xaPy3t7eWKRQpktyGNAH3//AMERP+C13w6/4LKfCbxTr+lfCm98E+MfAV1ZweLvDsl/9ttVS7E5tbi3ufLj8xJPs0+UZFeNkIO5Srv+EX/BoZ/ymR0X/sn+vf8AoqOvr7/gxj/5ui/7kn/3P18g/wDBoZ/ymR0X/sn+vf8AoqOgD+ryiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA5X47fGDwn+z18EPGXx+8etMuheB/CuoeINaa2iMkgtLO2kuZtijlm8uNsAdTxX8H/jHxh4r+IXi7VPH/jzxJfa1rmualPqGtaxql089zfXc0jSTTzSOS0kjuzMzMSWZiSSTX9t3/BVazu9Q/4Je/tI6fp9rJPcT/ATxhHDDDGWeR20S7AVQOSSeAB1Nfw/0AfSH/BIb9jXR/8AgoB/wUl+Ev7J/im5jj0PxJ4kafxIsk0sfn6XZW8t/ewI8XzRyS21rLEjjG15EJIAJH9r3hnw14c8F+G9P8HeDvD9jpOkaTYw2Wl6VplqlvbWVtEgSKGKJAFjjRFVVRQFVQAAAK/k+/4NKfGXhzwx/wAFpfBmia5ZNLdeI/CPiDTtHkVc+TcrYSXbOfQeRazr9WA71/WfQAUUUUAfPP8AwVR/YQ8G/wDBSD9hTx9+yx4l0fTZtU1bR5brwTqOpDauk6/CjNYXYkCO8SiXEcjRjc0Es8fKyMD/ABE1/f2zBV3MeBX8CnirV7HxB4o1LXtM0K30u2vtQmuLfTLUkxWkbuWWFM87UBCjPOBQBP4b8e+MfB+jeIPD3hnxBcWdl4q0hNL8RW8LDbf2aXlterC/HKi5s7aXjHzQr9KyKKKACivqD/gnr+xjL+2h8Gv2lNO0O1M3iD4bfBlvHvh2M3Txo0mnalafa1KorGVm06a/WOPADTNFyMZr5foA/r0/4Nj/ANuZP21f+CUfgvTvEGqGfxZ8KGPgfxIskaRl47ONDp8ygSM7q1g9qjSuFLzw3OBhcn8Y/wDg7r/bti/ah/4KRQ/s3eENct7zwt8C9JbR1ezuLe4ik1y7EU+puskWWDIEtLOSF2JimsJhhSWFeX/8G9X/AAV4s/8Agk/8bfihrPjiJ77wr4z+F+ovHorOsMN54j0y3nu9IWWYRSSxLKxurEFAVD6kkjqRECvwf8QfH3jL4rePdc+KPxF8Q3Gr+IPEmsXOq67q1426a9vLiVpZp3I6s8jsx9yaAMeivqX/AIIufsRj/goN/wAFLvhZ+zlrOgtf+GZteXV/HUclvcNB/YliDdXcUzwYaBZ0jFosu5QJbqIbgWFfLVAH0f8A8Eef+Ur37Nv/AGXDwx/6dLev7ba/iS/4I8/8pXv2bf8AsuHhj/06W9f220Afz3/8F6/+Dff/AIKcft5f8FPvHf7Tn7N3wn0PVPCGu6fo0Wm3174wsbSR2t9MtreUGKWQOuJI3HI5AyODXm0//BIP/g7p1qF9G1j9q74oPaXamG6S8/ahuZImjYbWDr9ubcuCcjByOx6V/Slqeqabomm3Gs6zqEFnZ2kDzXV1dTCOOGNVLM7sxAVQASSTgAZNeFL/AMFWP+CXb3Isk/4KR/ANpmk2CEfGHRNxbONuPtWc54xQB+Vf/BJn/g0Bb4EfGrR/2iv+Ck/xJ8K+Mj4cvvtmifDHwolxc6Zd3KiJ7efUbq4jhaZI5PN3WSwmKRkiLzSRGW3k+ov+DnD/AIJrftZf8FM/2Xvh38L/ANkfwZp+tax4e8fNqmqQ6jrlvYrHbGyni3Bp2UMd7qMDnvX6UadqWn6xp8GraTfw3VrdQrNbXNvKHjmjYAq6sMhlIIII4INTUAfnJ+xt+wB8O/gD/wAG8Wm/sBf8FadX8N+B9Bg0fWbDx9qmp+LLG3s9Ha98RXdzYXKX8rG2jnSS4s5IWbcon8tSrH5T+YH7Nf8Awbzf8FBND8a+MtT/AOCNn/BcD4Q694T8y1tdY8R/Dn4w6ppV5c/umaOPULfRI7yKNkZ5/KDXEhK5cbCzKv8ARb8ePgT8Jf2nPg54j+AHx38D2fiTwj4s0uTT9e0a+3BLiFx1DKQ8cisFdJUZZI3RXRldVYfjDqH/AAaWfG39krxN4i+KH7BH/BZfxn8J9FulP9oNcW9zpd1baVGpkb7XqWnX1ulyEK7/AJoIYwMn5dvIB+UH/Bbz/gn2P2Af2z9C/Z6k/aT1T4zfEbXvBdrr/wAT/Ed1L511N4k1DUb5jB5ZeWdXa1FjJ+/keaZpzP8AKs6Rp+3/APwdJf8ABJr9tf8A4Kif8KL/AOGPfAWl65/wg3/CTf8ACRf2l4htrDyftv8AZP2fb57rvz9kmztzjaM9RWV/wSu/4N2f2KPhP+1zN+2L8WP+ChUH7UPxK0TWk8Q6XNDc26x2epGQyf2neqt7eT3lyJ9skczyoqyAsySPtZP2AoA+cfgj+x3rGsf8EjPCP/AP/wCOjyaRf3X7OOn/AA+8ZNplxHM9lM2gR6bdmJxlHKMZNrDKnAPINfg18A/+CH3/AAc2/wDBKf49a54p/YC0XR7u61LRhpt94t8J+LPD0+nalatIk3lm118xOHR41+drcMp3BHKs27+nOigD8R/+Dk7/AIN9v2wf28vj9of7bn7E1ro/iLXB4Ts9F8WeB7rVotNvpbi3mfyr+2uLmRLaQGKbZJG7wmMWqMhmMpWOl8RPgD/wdv8A/BR39m/Wf2P/ANpix+GPwg8N3HhpoPEXiePVrCPUvGoWPH2CV9KubtYRcSKvn+VHaRNG8iHdGzW7/uLXM/EP40fB74Q/Y/8AhbHxY8M+F/7Q8z+z/wDhItdt7L7T5e3f5fnOu/bvTOM43rnqKAPyn/4NeP8Aglf+3x/wS18ZfGTQ/wBrn4L6fpOk/ELS9En0rXNN8XWV6sVxp0l6ptnihdnzImoFw+Nq/Z2B5da8L/4N5v8Aggp/wUn/AOCe3/BR7Tf2jf2n/hZouk+FbfwjqthLeWPi2yvJBPPGojXy4ZGbBIPOMCv3o0PXdE8T6Na+I/DWsWuoaff26XFjf2Nws0NxC43LIjqSrqwIIYEgg5FWqACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAjvLS11C0lsL2BZYZo2jmikXKupGCCO4Ir+FH9sb9mXxn+xl+1V8QP2VvH4uH1PwH4svNIa8uNPktft8MUpEF6kUnzLFcQ+XcRnJDRzIwJBBP92Vfgn/AMHf3/BIbxJ4uNt/wVW/Z98HrdNpmmRab8abOzdFm+zxFIrHWBEEDTbFP2a4bezJFHZsIxHHPIgB+Ff7Lv7RfxF/ZF/aM8E/tO/Ca5jj8ReBfEtprOmR3EkqwXLQyB2tp/JeN2glQNFKiupeOR1yN1f2vfsH/t1fs8f8FGP2atD/AGof2afFq6loerL5OoWE21b3RNQRVM+nXkQJ8m4iLrkZKujxyxtJFLHI/wDDLXvX/BP/AP4KX/tjf8EyvipJ8U/2SfitNorahJbDxJ4dvYRc6Tr8EEm9YLy2bhxhpEEqFJ4lnl8qWMuxIB/cFRX8+3wt/wCD4vXbbw9pmnfGr/gnbaXurR2irrOseF/iO1rb3E4Xl4bOexlaFC2MI1zIVB+82OeC/ak/4PYP2nviJ8PpvCv7J/7Ivh34Z61dRzRS+KfEHiZvEU1sjRlVltYPstrDHOjkOGnFxEduGiYGgD9Fv+Cmn/grb4I/YC/Yr1z9nbwB4ztW+Mfxa0KbS9B0e3uH+1aPo9wHgu9YfymVoAEEsNu5ZWa4O9FkW2nCfyZ11Pxr+N3xd/aP+KetfG748fEXVvFni3xDdC41nX9cvGnuLlwiogLN0RI0SNEGFjRERQqqoGH4c8OeIfGPiGw8I+EdBvdV1bVb2Kz0vS9NtXnuLy4lcJHDFGgLSSO7BVVQSxIABJoA9F+CP7MPin4y/A34zfHq0jvYNE+D/hHTNW1C+jsWe3lur7XtO0u3snl+7FJIl3dToDywsZMAgMR5bX9CX7QP/BKk/wDBK/8A4NPPjJ4R+Imh2sPxU8d3HhbXfiZcRtbzPa3B8SaSttpS3EK/vIbSLI2+ZKguJ7ySJykwFfz20Afst/wZPKsn/BQn4po6hlb4LzBlYcH/AIm2nV+e/wDwVw/Yu/4d9/8ABRn4rfsrafbRx6LoPiZ7nwmsdxLOBot4i3lghllVWkkjtp4opW5HmxyAMwG4/oV/wZN/8pDPil/2Rmb/ANO2nV7t/wAHsX7FMmpeHvhT/wAFCfDGn75NNd/AnjCTzpXYW7ma90xxGFMaRpJ/aKPISpL3NuuG4wAfz40UVf8ACvhbxN458T6b4J8F+H7zVtY1i/hsdJ0rTbVpri9upXEcUMUaAtJI7sqqqgliQACTQB/Qz/wZV/sLv4U+FXxI/wCCh3jPQJIr3xXdDwd4HuLi3nib+zbZ0uNQnjJIjnhmuvssQYAlJNMmXcMsK/nXr+5v/gn9+yT4Z/YR/Ys+Gv7I/hX7I8fgfwrbWOoXljHIkV/qJHm314qyMzJ9ou5LifbkhTLgYAAH8MlAH0f/AMEef+Ur37Nv/ZcPDH/p0t6/ttr+JL/gjz/yle/Zt/7Lh4Y/9OlvX9ttAH8vn/B2b+3b+0F8cP8AgpbqX/BPw/EC40D4a/Dq30a3j0P+1TDp2palfWVtfvql6FUbjGt3FCgkMiwrbu8exp5g3174m/4Mif2bT8DzpPg79tnxwvxJjtVx4g1PQ7NtDnmDAsP7PQC4iRlyoP2uQoSG/eBdje4f8F3v+DarQP8AgqP8Qf8Ahqz9nH4m6T4H+LH9k29hq9rrtiRpHiVYSEimuZrdGnguI4D5fnbJ98cEEWxAvmD8uLT/AIJx/wDB0t/wSPU3f7Og+J8/hPw7rROm2nwn8WL4j0e+mlxuuF0APJJKjH7zT2IxjLADBoA94/4NetL/AOCwP7E37c9v+yj8dP2VPjZo/wAE/GdnqkGrjxb4N1O20Hw5qdtbzXcOpQTzWxhiaZ4GtSI5I0uDdxMxkaGAD95/2k/2p/2c/wBjv4YXHxm/ah+M/h/wP4Zt2aMap4g1BIBcziGSYW1uh+e5uGjhlZLeJXlfy22IxGK/FX/gg3/wdMfHD9oD9ovw5+xN/wAFH/7I1S88ZXUel+CfiZpOkxWFw2rySv5VpqNvDtgZZy0dvDJbxRGORY1kSQTNND8i/wDBWL4s+Pf+Cyf/AAcT6f8AsW6v4w8TR/D/AMPfFq3+G+h6OJIY20O1guorXXb63jy0Rlkmgu7gSuGkkiitkcYijjQA/bTwj/wczf8ABDvxt4p07wfo37d2nQ3eqXkdrbTav4K17T7VHdgoM1zdWEcFvHk/NJK6IoyWYAE17N/wUj8V+FvHn/BJv4+eOPA/iTT9a0XWv2d/FN9o+saTeJcWt9ay6FdSRTwyxkpLG6MrK6kqysCCQa+I/wBvv/g1r/4JYRfsNeP5v2Y/2fL7wr8RPDngu+1Lwn4it/Gmp3Etzf20DTxw3CXdzJA0c7xiNz5YKLITGUwK/O3/AIN+P26fiDrn/BNv9tj/AIJ3+NvE+palomk/s0+LfGXgOzuZN8OjRiwuLfUoYyQWSOWW8s5hECEWQXEgXfNIzAHa/wDBkR/ydf8AG4/9U8sP/S6v2x/Y/wD+Cuf/AATq/b4+Jd98Hv2Rv2mNP8Z+JNN0OTWb7S7XRdQt2isY5oYHm3XNvGhAkuIVwGLfP0wCR+J3/BkR/wAnX/G7/snlh/6X1wX/AAGU/wDKU3x9/wBm/wCq/wDp80OgD+hr9sf/AKBB/se/8E/fDWjeMP2wfjXZ+CtN8QX0lno91eabd3IuZ0TeyAW0MhGF5ywA9643xl/wWE/4Ju/D79l7wj+2h4w/af06x+GPjrVbjTfCfit9F1FotQuoJLiOWJYltzMhV7WcZdFB8s4JyM/mv/we8/8AJq3wP/7KBqH/AKQivWv+CKP/AAT2/ZA/4KL/APBvZ+zt8L/2yfhF/wAJjoWh6t4k1XS7H+39Q0/yLv8A4SHWIvM32NxC7fJI67WYrznGQCAD83/+DdT/AILd+Kvg3+2z4o8T/wDBUX/got8Rrz4fz/Cy+tdHj+IHjDW9esxrDalprxFLctPsl+zpd4k2DCl13Dfg/oH/AMHHnwm/4Jnft5fDr9m34t/tO/8ABSaP4N+Hb/RNb1f4canH8Pb3WF8UWV/Do8zTBYyjW4jjW1bEgDN9p6AoRX5R/wDBr/8AsFfsnf8ABRL9vrxd8FP2xfhT/wAJh4Z0v4P6hrdjpv8Abl/p/lX8eq6VAk3mWM8MhxFczLtLFTvyQSFI+wf+D0n4ZeCPgp8Mf2Ofg38MtE/s3w34S0HxVovh/TftMs32SxtYfD0EEXmSs0j7Y0VdzszHGWJJJoA/bj/gnp4X+Gvw+/YH+Dfg74SfExfGHhHRfhdodp4d8YNp72Y1iwisIVhvfJc7ofMjCybGOV3YPSvAfiX/AMHJP/BEf4TeOL/4e+Kf29dCur/TWRbi48M+G9Y1qxcsiuPKvdPs57acYYAmORgrBlOGVgPy7/4LafttfFT4C/8ABvV+xR+yb8Nb260y0+M3wk0qTxZq9neKjzaZpekaYW00p5ZYpPNfwSM6SIQtmYmDpO4H0T/wRo/4Nl/+Cbfjz/gnH8NvjV+2j8D/APhYHjv4keHIPFN1qS+NdWtbexsL9EuLG0gjs5rULstTA0hdZH8+S4AlaLy1UA/Uf9kv9uP9kb9uzwE3xK/ZH+P/AId8daXCsbXy6PeYutPMm/y1u7SQLcWbt5blUnjjZgpIBHNcN8Q/+Cuf/AOr4Ufta2/7CvxB/aY0/Tfixda5pejW/g+TRdQeV77UUgeyh81Lcw5lW6gIPmbR5g3FcHH86XhLSr3/AIIKf8HLVp8FfgL8TtTuvB+kfELRNC1iTUlcNe+GdcgsbiezuUikVbl7eK9VkdsI1xZQz+WpAjXN/wCDg34T+OPj3/wcoePPgX8Mbq3t/EnjTxd4H0Hw9PdXTQxR315oWi28DPIoJjUSSISwBKjkA4oA/fD4q/8ABx//AMET/g14/wBR+GnjP9vDQ59U0uREvJPDfhvV9as9zIr4jvNPs57abAYBvLkbawZGwyso+tfgr8bvhF+0d8LdH+NvwH+I2keLPCfiC3M+j+INDvFuLa5VXaNwGU8OkiPG6HDI6OjBWVgPx8/4K0/8Gy//AATN/Z//AOCWHxE+KP7L/wAJ9U0T4ifDbwdHrUHjPU/GGo3k2qx2Kq959qt5Jvsu+eBJmPkwwqspQoqIDGfn7/g1T8WftMfEv/gmx+3N+zJ8A9dv01+18IJf/C+30nUU0+7tvE2q6Pq9ok0N4Xj8iRpNO04JI0iLE0QfcvLUAfrV+0j/AMF+v+CQP7JfxX1D4IfHD9tjQ7PxRpMjxavpuh6HqetCwnSV4pLaeXTbWeKG4jkjdXgdlljI+dFyM93+xX/wVj/4J3f8FD9R1DQf2Pv2pNC8W6tpatJeaDJbXWm6kIV2bp0s7+KGeSBTJGpmRGjDMFLBuK/lr/4JS/tHfsP/APBN/wDaT8ZeG/8AgrR/wTZ1P4hzNBFp62Ov6TG+oeEJoxM00baLqXlQXEk7NbAvM8clusJMe7zHVv0Y/wCCeHwV/wCDb/8Aad/4KM+Cv2p/2HP2yviL8E/iNH4ss9e8O/BPVGXSLUXEc0UUmmRTTRSRzJelnVrG3vpGeK6lijRIx5aAH9AlFFFABRRRQAUUUUAFFFFABRRRQAVU1/QNC8V6Fe+F/FGi2mpaZqVpJa6jp1/brNBdQSKUkikjcFXRlJVlYEEEggg1booA/nA/4LZf8Gn/AMT/AIUa3qf7S3/BLnwpfeLvCN1NcXeufCe3YSapoChGl3adubdqFv8AKyLbruulYxKi3Idmi/EzW9E1rwzrN54c8R6RdafqGn3Ultf2F9btFNbTIxV4pEYBkdWBUqQCCCDzX9+VfP8A+2J/wSt/4J4/t9n7X+1r+yb4U8Wal+4H/CR/Z5LDWPLh3+XD/aNk8N35I3t+583yyTkqSBgA/iDor+pbx9/wZn/8EmfGPjDUPEvh7x18Z/ClleXDSW/h/QPGFhJZ2KnpFE17p9xcFR28yaRvVjXQ/BD/AINBP+COnwo1K8vvHfhv4jfEyO6gVILPxv45aCOzYNnzIzo8VixYj5SJGdcdFB5oA/mC/Zz/AGZ/j/8Atc/FbTvgh+zR8I9c8aeKtUkVbbSdDszK0aGRIzPM/CW8CtIm+eVkijB3O6qCa/pY/wCCBH/Btf4Q/wCCe26L+11+2Itn4h+Nz2vn6XodvIs2neCfMRlMaOpK3d7sba84zFGzMkO8KLiT9LP2eP2V/wBmz9krwUfh1+zH8CPCngPRZGje5sfCuhwWa3cqRrEJp2jUNcTbEUGWUtI2PmYnmu+oA+AP+Do3/lBR8cv+5Z/9SfSa/kCr+/DX/D3h/wAV6TNoHinQrPUrG42+fZahapNDJtYMu5HBU4YAjI4IB7Vzf/DPPwA/6Ib4P/8ACZtf/jdAH85f/Bk3/wApDPil/wBkZm/9O2nV++n/AAUm/Y90j9vv9hL4ofsi6mloLjxn4Vmt9DuNQupobe11aIrcadcytDl/LivYbaVlAbcsZUqwJU+p+Fvhd8M/A17JqXgn4daFo9xNF5ctxpekQ27umQdpaNQSMgHHTIFbtAH8Beq6Vqmhapc6Jrem3Fne2dw8F5Z3ULRywSoxVo3VgCrKwIKkAgjBr9Kv+DUn9hj/AIa4/wCCpOjfFfxX4fe68JfBWxPizUJJrKR7eTVQ3laVAZUZRFMLhjex7shxpsi7SMkf1Qaj8Cfghq+oT6tq3wb8K3V1dTNNdXVx4dtnkmkY5Z2YoSzEkkk8kmtLwn8PPAHgL7R/wg3gbR9F+1bftX9k6ZFbedtzt3eWo3Y3NjPTccdTQBsV/AHX9/lcf/wzz8AP+iG+D/8AwmbX/wCN0Afxhf8ABHn/AJSvfs2/9lw8Mf8Ap0t6/ttrldM+BnwS0XUYNX0f4O+FbS7tZlltrq18PW0ckUinKsrKgKsDyCDkGuqoA/lk/wCC6/7CX7V3/BJH/grTJ/wU2+GPg+TW/AviL4tR/ELwh4puI5bmxtdca9XULjSdT8nyjBm683y494E9qw2StIlwsX2z4f8A+D3n9mOb4RTav4p/Yd8eW3jxYZfs/h3T/EdlPpEsgLeWG1F1jmRWG0sRZuULEAPtBb9vL+wsdVsZtM1OyhuLa4iaK4t7iMOksbDDKynhgQSCDwQa8Juf+CUv/BLq8uJLy8/4Jt/AOaaZy8ssnwd0Rmdickkm1yST3oA/nK/4Iz/ALJn7R3/AAV6/wCCt0P/AAUHj+GF54X8B6T8bJ/iP4u8RWWnltNsb6G/XVIdHimZUSe4kme2jYA+aIpGnZT0bvf+C+n7GXx+/wCCUf8AwWM03/gqv8GPg/NefDfXPiJpvjrTdTtJLmSxg18OaGfUdO1CUMXt2u7pZp1BKxyRXjpDnyJUj/pq0TRNFsLW00PRtN0+0e2tvsUFpaW6QokAjVRGqqAAoXoAMDFJ4k0LQ/Fnh+/8L+JdJttQ03VLKWz1CwvIVlhureVCkkUiMCroyMVZSCCCQaAP5VP+DgD/grG3/BYn4R+BPi/+zh+z3488N/BX4Y+KptG1bxZ40a0t/7U8Sapamezs1toJplzBa6bcv8A6tpALrEiw74fO/aH/g14/wCUFXwL/wB3xJ/6k2q19paT8CvgjoPw90v4SaF8HPC1l4U0RVXRfDNp4etoNPsArhlENsqCOIAO2NqjG4+pre0Dw9oHhTSYdA8L6FZ6bY2+7yLLT7VIYY8sWO1EAUZYknA5JJ70Afx9/8EOf+Cjvh3/gill+3/wCKvif+0x8DvFl8sng3VPBXiTw/Ywpa6to159vtJ23290Y8yRzWHkvC7RsnmMckx7G+4f8Ag8V+M+hftHfAD9iP9obwtpV5Y6Z488H+I/EWnWOobfPt4L208OXMccmwld6rKA20kZBwSOa/fX4n/sufszfG7WIfEXxo/Z18C+LtQt4fJt77xR4RstQmijznYrzxMyrnnAOK2dT+Efwp1vSNN0DWvhl4fvLHR7cW+j2N1osEkNjCFVRHCjIViTaiDaoAwijsKAPxC/4KY/8ABLD4x/8ABQn/AIN6/wBkH4yfs3eHtR8ReOfgz8HdGu4/CGnyBpdX0e90aw+3C2gETPc3sb2dpJHErpvjFyqrLM0MZ4n/AIJKf8Hav7Ov7Jf7C/gr9ln9tP4PfE7WPEvw908aFpOveC9P0y6gvtJgJWyWRJ7m0MDwQeXa7QJd626yNJukZV/oN03TNN0bToNI0fT4LW0tYVitrW2hEccUajCoqqAFUDgADAFeWfFz9gf9hb4/+M5viP8AHj9i74T+NvEVxDHDNr3i74c6ZqV7JGg2ojT3EDuVUcAE4A6UAfzhfsGfCz9pb/g4L/4LyQ/8FCdV+B8vhj4faf8AELTPEnjDU7fT5brSdOs9Fhs1s9Ha5kMa3F5PFbWcL7CH/fy3IgWJDGuz/wAFLf8Alcj8O/8AZf8A4T/+kfh6v6bvCnhPwr4D8NWPgzwP4Z0/RtH0y2W303SdJs0t7a0hUYWOOKMBUQDgKoAFUb74V/DDVPEy+NdT+G+g3GsrNHMurT6PA90JIwBG/mld+5Qq7TnI2jGMCgDwf/gsv/yiZ/aQ/wCyLeIv/TfNX4q/8GirfH6L9mP9uK5/ZT+zt8TLfwj4Zn8A291HA0Vzq8cHiF7W3f7QyxBZZVSMs7Kqh8lgBkf0c6npema3p0+j6zp0F5aXUTRXNrdQrJHKhGCrKwIYEdQRg1neE/h58P8AwF9o/wCEG8DaPov2rb9q/snTIrbztudu7y1G7G5sZ6bjjqaAP56/2TP+DkT4X/EjxX4p/Z1/4ONP2XNJ8VTaLrkaeG49U+C9jdJ4YvIlnS+iv7G7/fQy7lhRTHE8gYurhQM18HfHr4c/BD/gpl/wVjsfBH/BD79mzxR4E0XxFq1l/ZsNzJOsem3xuQbnXPLtRM2j6dE8qNsRnEKRb0EW9baL+tf43fse/sk/tM39lqv7SH7Lfw5+IF1psJh0648b+CbDVpLWMnJSNrqFyikknCkDJrV+C/7PHwA/Zv8ADs3hD9nj4G+D/Aek3Fx59xpfgvwza6Xbyy/32jto0Ut/tEZoA7EcDpRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH//2Q==';

const PW = 210, PH = 297;
const ML = 19, MR = 16, MT = 20, MB = 14;
const CW = PW - ML - MR;
const GRAY = [166, 166, 166];
const FOOT_H = MB + 10;

// ── HEADER / FOOTER ──────────────────────────────────────────────────────────

function drawFirstPageHeader(doc, title, updatedAt, glpiId) {
  const hY = 7;
  try { doc.addImage('data:image/jpeg;base64,' + LOGO_B64, 'JPEG', ML, hY, 31, 8.4); } catch (e) {}

  const tx = ML + 42, tw = PW - MR - tx, rh = 6.2;
  doc.setDrawColor(...GRAY); doc.setLineWidth(0.3);

  doc.rect(tx, hY, tw, rh);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
  doc.text('SCOPE: OM Digital Solutions GmbH', tx + tw - 2, hY + 4.2, { align: 'right' });

  const leftW = tw * 0.48, labelW = tw * 0.32, valW = tw - leftW - labelW;
  const rows = [
    { label: 'Reference:', value: glpiId ? `#${glpiId}` : '—' },
    { label: 'Effective Date:', value: updatedAt || '' },
    { label: 'Page:', value: '1 / 1' },
  ];
  rows.forEach((row, i) => {
    const ry = hY + rh + i * rh;
    doc.rect(tx, ry, leftW, rh);
    doc.rect(tx + leftW, ry, labelW, rh);
    doc.rect(tx + leftW + labelW, ry, valW, rh);
    if (i === 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.text(doc.splitTextToSize(title, leftW - 3)[0], tx + 2, ry + 4.2);
    }
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7);
    doc.text(row.label, tx + leftW + 2, ry + 4.2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.text(row.value, tx + leftW + labelW + valW - 2, ry + 4.2, { align: 'right' });
  });

  return hY + rh * 4 + 5;
}

function drawRunningHeader(doc, title) {
  const hY = MT - 12, hH = 9.8;
  const c1 = 27, c2 = 34, c3 = CW - c1 - c2;
  doc.setDrawColor(...GRAY); doc.setLineWidth(0.3);
  doc.rect(ML, hY, CW, hH);
  doc.line(ML + c1, hY, ML + c1, hY + hH);
  doc.line(ML + c1 + c2, hY, ML + c1 + c2, hY + hH);
  try { doc.addImage('data:image/jpeg;base64,' + LOGO_B64, 'JPEG', ML + 2, hY + 1.5, 22, 6); } catch (e) {}
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
  doc.text('IT', ML + c1 + c2 / 2, hY + hH / 2 + 1.5, { align: 'center' });
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(8);
  doc.text(doc.splitTextToSize(title, c3 - 4)[0], ML + c1 + c2 + c3 / 2, hY + hH / 2 + 1.5, { align: 'center' });
  return MT;
}

function drawFooter(doc, pageNum, totalPages) {
  const fy = PH - MB + 2;
  const label = 'Restricted use: IT department only. External disclosure prohibited.';
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
  doc.text(label, PW / 2, fy, { align: 'center' });
  const startX = PW / 2 - doc.getTextWidth(label) / 2;
  const ruEnd = doc.getTextWidth('Restricted use');
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
  doc.line(startX, fy + 0.6, startX + ruEnd, fy + 0.6);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(`${pageNum} / ${totalPages}`, PW - MR, fy + 5, { align: 'right' });
}

// ── INLINE MARKDOWN CLEANER (does NOT collapse newlines) ─────────────────────

function stripInline(text) {
  return (text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/ +/g, ' ')
    .trim();
}

function parseTableRow(line) {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => stripInline(c.trim()));
}

function isSepRow(line) {
  return /^\|[\s\-:|]+\|/.test(line);
}

// ── CONTENT RENDERER ─────────────────────────────────────────────────────────

function renderContent(doc, content, startY, title) {
  let y = startY;

  function newPage() {
    doc.addPage();
    y = drawRunningHeader(doc, title);
  }

  function checkPage(needed) {
    if (y + needed > PH - FOOT_H) newPage();
  }

  function renderTable(tableLines) {
    const headerCells = parseTableRow(tableLines[0]);
    const dataRows = tableLines
      .slice(1)
      .filter(l => !isSepRow(l) && l.trim() !== '')
      .map(parseTableRow);

    const cols = headerCells.length;
    if (cols === 0) return;

    const colW = cols === 2
      ? [CW * 0.38, CW * 0.62]
      : Array(cols).fill(CW / cols);

    const PAD = 2.5;
    const HDR_H = 7;

    checkPage(HDR_H + 8);
    doc.setFillColor(20, 30, 55);
    doc.setTextColor(220, 228, 244);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setDrawColor(...GRAY);
    doc.setLineWidth(0.25);
    let x = ML;
    headerCells.forEach((cell, ci) => {
      if (ci < colW.length) {
        doc.rect(x, y, colW[ci], HDR_H, 'FD');
        doc.text(doc.splitTextToSize(cell, colW[ci] - PAD * 2)[0] || '', x + PAD, y + 4.8);
        x += colW[ci];
      }
    });
    y += HDR_H;

    dataRows.forEach((row, ri) => {
      doc.setFontSize(8.5);
      let maxLines = 1;
      row.forEach((cell, ci) => {
        if (ci < colW.length) {
          maxLines = Math.max(maxLines, doc.splitTextToSize(cell, colW[ci] - PAD * 2).length);
        }
      });
      const rowH = Math.max(6, maxLines * 4.5 + PAD * 2);

      checkPage(rowH + 2);
      doc.setDrawColor(...GRAY); doc.setLineWidth(0.25);
      x = ML;
      row.forEach((cell, ci) => {
        if (ci >= colW.length) return;
        if (ri % 2 === 0) doc.setFillColor(247, 249, 252);
        else doc.setFillColor(255, 255, 255);
        doc.rect(x, y, colW[ci], rowH, 'FD');
        if (cols === 2 && ci === 0) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        } else {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        }
        doc.setTextColor(20, 20, 20);
        doc.splitTextToSize(cell, colW[ci] - PAD * 2).forEach((wl, li) => {
          doc.text(wl, x + PAD, y + PAD + 3.5 + li * 4.5);
        });
        x += colW[ci];
      });
      y += rowH;
    });
    y += 5;
  }

  // Walk lines one by one — never collapse across newlines
  const lines = content.split('\n');
  let i = 0;
  const LH = 5;

  while (i < lines.length) {
    const line = lines[i];

    // H2
    if (/^## /.test(line)) {
      checkPage(16);
      y += 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(0, 0, 0);
      doc.text(stripInline(line.slice(3)), ML, y);
      y += 2;
      doc.setDrawColor(59, 130, 246); doc.setLineWidth(0.7);
      doc.line(ML, y, ML + CW, y);
      doc.setDrawColor(...GRAY); doc.setLineWidth(0.25);
      y += 5;
      i++; continue;
    }

    // H3
    if (/^### /.test(line)) {
      checkPage(12);
      y += 4;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 90, 190);
      doc.text(stripInline(line.slice(4)), ML, y);
      y += 5; doc.setTextColor(0, 0, 0);
      i++; continue;
    }

    // H1
    if (/^# /.test(line)) {
      checkPage(16);
      y += 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(0, 0, 0);
      doc.text(stripInline(line.slice(2)), ML, y);
      y += 8; i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      checkPage(8);
      doc.setDrawColor(...GRAY); doc.setLineWidth(0.3);
      doc.line(ML, y, ML + CW, y);
      y += 5; i++; continue;
    }

    // Table block — collect all consecutive table lines
    if (/^\|/.test(line)) {
      const tableLines = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) renderTable(tableLines);
      continue;
    }

    // Code block
    if (/^```/.test(line)) {
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      if (codeLines.length) {
        const bH = codeLines.length * 4.5 + 6;
        checkPage(bH + 4);
        doc.setFillColor(240, 242, 246); doc.setDrawColor(...GRAY); doc.setLineWidth(0.2);
        doc.rect(ML, y - 1, CW, bH, 'FD');
        doc.setFont('courier', 'normal'); doc.setFontSize(8); doc.setTextColor(40, 40, 40);
        codeLines.forEach(cl => { doc.text(cl.substring(0, 100), ML + 2, y + 3); y += 4.5; });
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
        y += 4;
      }
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      y += 2.5; i++; continue;
    }

    // List item
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.) (.+)/);
    if (listMatch) {
      const text = '• ' + stripInline(listMatch[3]);
      const indX = ML + Math.min(listMatch[1].length, 4) * 2;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
      doc.splitTextToSize(text, CW - (indX - ML)).forEach(wl => {
        checkPage(LH); doc.text(wl, indX, y); y += LH;
      });
      i++; continue;
    }

    // Normal paragraph line
    const text = stripInline(line);
    if (text) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
      doc.splitTextToSize(text, CW).forEach(wl => { checkPage(LH); doc.text(wl, ML, y); y += LH; });
    }
    i++;
  }

  return y;
}

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────

export function generateKnowledgePDF(entry) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const title     = entry.topic    || 'Knowledge Entry';
  const category  = (entry.category || '').toUpperCase();
  const source    = entry.source   || '';
  const tags      = (entry.tags    || []).join(' · ');
  const updatedAt = (entry.updatedAt || entry.glpiSyncedAt || '').substring(0, 10);
  const glpiId    = entry.glpiId   || entry.dataflowId || '';
  const content   = entry.content  || '';

  let y = drawFirstPageHeader(doc, title, updatedAt, glpiId);

  const meta = [category, source, glpiId ? `GLPI #${glpiId}` : '', tags].filter(Boolean).join('  ·  ');
  if (meta) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
    doc.text(meta, ML, y);
    y += 6;
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(0, 0, 0);
  const titleLines = doc.splitTextToSize(title, CW);
  doc.text(titleLines, ML, y);
  y += titleLines.length * 7 + 2;

  if (updatedAt) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    doc.text(`Last updated: ${updatedAt}`, ML, y);
    y += 5;
  }

  doc.setDrawColor(...GRAY); doc.setLineWidth(0.3);
  doc.line(ML, y, ML + CW, y);
  y += 6;

  renderContent(doc, content, y, title);

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total);
  }

  const filename = `ARIA_KB_${title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.pdf`;
  doc.save(filename);
}
